/**
 * Project: Smart Task Management
 * Component: Notification Service
 * Description: Implements notification management logic, utilizing R2DBC for reactive database interactions and fallback repository mechanisms.
 */
package com.smarttask.notification.service;

import com.smarttask.notification.entity.Notification;
import com.smarttask.common.entities.enums.NotificationType;
import com.smarttask.notification.repository.NotificationRepository;
import com.smarttask.notification.dto.NotificationResponseDTO;
import com.smarttask.notification.websocket.NotificationWebSocketHandler;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;
import com.smarttask.common.security.JwtService;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Objects;
import java.util.function.Supplier;

@Service
@Slf4j
public class NotificationService {

        private final NotificationRepository notificationRepository;
        private final DatabaseClient databaseClient;
        private final NotificationWebSocketHandler webSocketHandler;
        private final JwtService jwtService;

        private final Sinks.Many<NotificationResponseDTO> sseSink = Sinks.many().multicast().onBackpressureBuffer();
        private static final long DUPLICATE_WINDOW_SECONDS = 10;
        private static final String PARAM_USER_ID = "userId";
        private static final String PARAM_TYPE = "type";
        private static final String PARAM_MESSAGE = "message";
        private static final String PARAM_CUTOFF = "cutoff";
        private static final String PARAM_CARD_ID = "cardId";
        private static final String PARAM_WORKSPACE_ID = "workspaceId";
        private static final String PARAM_BOARD_ID = "boardId";
        private static final String PARAM_ACTION_TOKEN = "actionToken";
        private static final String PARAM_IS_READ = "isRead";
        private static final String PARAM_NOTIFICATION_ID = "notificationId";

        public NotificationService(
                        NotificationRepository notificationRepository,
                        DatabaseClient databaseClient,
                        @Lazy NotificationWebSocketHandler webSocketHandler,
                        JwtService jwtService) {
                this.notificationRepository = notificationRepository;
                this.databaseClient = databaseClient;
                this.webSocketHandler = webSocketHandler;
                this.jwtService = jwtService;
        }

        /**
         * Initializes the notifications table in the database if it doesn't already
         * exist.
         */
        @PostConstruct
        public void ensureNotificationsTable() {
                databaseClient
                                .sql("CREATE TABLE IF NOT EXISTS notifications ("
                                                + "id BIGINT AUTO_INCREMENT PRIMARY KEY,"
                                                + "user_id BIGINT NOT NULL,"
                                                + "card_id BIGINT NULL,"
                                                + "message TEXT NOT NULL,"
                                                + "type ENUM('CARD_ASSIGNED','DUE_REMINDER','LIST_CHANGED','WORKSPACE_INVITATION','MENTION') NOT NULL,"
                                                + "action_token VARCHAR(255) NULL,"
                                                + "is_read BOOLEAN NOT NULL DEFAULT FALSE,"
                                                + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                                                + "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,"
                                                + "FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE SET NULL"
                                                + ")")
                                .fetch()
                                .rowsUpdated()
                                .doOnSuccess(rows -> log.info("Notifications table ensure completed, rows: {}", rows))
                                .doOnError(error -> log.error("Failed to ensure notifications table", error))
                                .subscribe();
        }

        /**
         * Creates and persists a new notification for a specific user.
         */
        public Mono<Void> createNotification(Long userId, String message, NotificationType type, Long cardId) {
                return createNotification(userId, message, type, cardId, null, null, null);
        }

        public Mono<Void> createNotification(Long userId, String message, NotificationType type, Long cardId,
                        Long workspaceId, Long boardId) {
                return createNotification(userId, message, type, cardId, null, workspaceId, boardId);
        }

        /**
         * Creates and persists a new notification for a specific user, including an
         * action token.
         */
        public Mono<Void> createNotification(Long userId, String message, NotificationType type, Long cardId,
                        String actionToken, Long workspaceId, Long boardId) {
                // Avoid double inserts from duplicated triggers (UI + API, scheduler + restart, etc.).
                // This does not prevent two different notifications; it only suppresses identical ones in a short window.
                return isDuplicateRecentNotification(userId, message, type, cardId, actionToken, workspaceId, boardId)
                                .flatMap(isDup -> {
                                        if (Boolean.TRUE.equals(isDup)) {
                                                log.debug("Suppressing duplicate notification user={} type={} cardId={} message='{}'",
                                                                userId, type, cardId, message);
                                                return Mono.empty();
                                        }
                                        return createAndPushNotification(userId, message, type, cardId, actionToken, workspaceId, boardId);
                                });
        }

        private Mono<Boolean> isDuplicateRecentNotification(
                        Long userId,
                        String message,
                        NotificationType type,
                        Long cardId,
                        String actionToken,
                        Long workspaceId,
                        Long boardId) {
                LocalDateTime cutoff = LocalDateTime.now().minusSeconds(DUPLICATE_WINDOW_SECONDS);

                String sql = "SELECT COUNT(1) AS cnt FROM notifications "
                                + "WHERE user_id = :userId "
                                + "AND type = :type "
                                + "AND message = :message "
                                + "AND ((:cardId IS NULL AND card_id IS NULL) OR card_id = :cardId) "
                                + "AND ((:workspaceId IS NULL AND workspace_id IS NULL) OR workspace_id = :workspaceId) "
                                + "AND ((:boardId IS NULL AND board_id IS NULL) OR board_id = :boardId) "
                                + "AND ((:actionToken IS NULL AND action_token IS NULL) OR action_token = :actionToken) "
                                + "AND created_at >= :cutoff";

                DatabaseClient.GenericExecuteSpec spec = databaseClient.sql(sql)
                                .bind(PARAM_USER_ID, userId)
                                .bind(PARAM_TYPE, type.name())
                                .bind(PARAM_MESSAGE, Objects.toString(message, ""))
                                .bind(PARAM_CUTOFF, cutoff);
                spec = bindNotificationContext(spec, cardId, workspaceId, boardId, actionToken);

                return spec.map((row, meta) -> {
                                Object raw = row.get("cnt");
                                if (raw instanceof Number n) {
                                        return n.longValue();
                                }
                                if (raw instanceof String s) {
                                        Long parsed = parseLongValue(s);
                                        return parsed != null ? parsed : 0L;
                                }
                                return 0L;
                        })
                        .one()
                        .map(cnt -> cnt != null && cnt > 0)
                        .defaultIfEmpty(false)
                        // If the dedupe query fails, don't block notifications.
                        .onErrorReturn(false);
        }

        private static String escapeJson(String s) {
                if (s == null) {
                        return "";
                }
                return s.replace("\\", "\\\\")
                                .replace("\"", "\\\"")
                                .replace("\r", "\\r")
                                .replace("\n", "\\n");
        }

        private Mono<Void> createAndPushNotification(Long userId, String message, NotificationType type, Long cardId,
                        String actionToken, Long workspaceId, Long boardId) {
                Notification notification = Notification.builder()
                                .userId(userId)
                                .message(message)
                                .type(type)
                                .cardId(cardId)
                                .workspaceId(workspaceId)
                                .boardId(boardId)
                                .actionToken(actionToken)
                                .isRead(false)
                                .createdAt(LocalDateTime.now())
                                .build();
                String sql = "INSERT INTO notifications (user_id, card_id, workspace_id, board_id, message, type, action_token, is_read, created_at) "
                                + "VALUES (:userId, :cardId, :workspaceId, :boardId, :message, :type, :actionToken, :isRead, NOW())";

                org.springframework.r2dbc.core.DatabaseClient.GenericExecuteSpec spec = databaseClient
                                .sql(sql)
                                .bind(PARAM_USER_ID, userId)
                                .bind(PARAM_MESSAGE, message)
                                .bind(PARAM_TYPE, type.name())
                                .bind(PARAM_IS_READ, false);
                spec = bindNotificationContext(spec, cardId, workspaceId, boardId, actionToken);

                return spec.fetch()
                                .rowsUpdated()
                                .doOnNext(rows -> {
                                        log.info(
                                                        "Notification insert attempted for user {} type {} rowsUpdated={}",
                                                        userId, type, rows);
                                        if (rows > 0) {
                                                pushRealtimeNotification(userId, message, type, cardId, workspaceId,
                                                                boardId);
                                        }
                                })
                                .flatMap(rows -> rows > 0 ? Mono.<Void>empty()
                                                : Mono.<Void>error(new ResponseStatusException(
                                                                HttpStatus.INTERNAL_SERVER_ERROR,
                                                                "Failed to persist notification")))
                                .onErrorResume(error -> {
                                        log.error("Notification SQL insert failed for user {}, trying repository fallback: {}",
                                                        userId, error.getMessage(), error);
                                        return notificationRepository.save(notification).then();
                                });
        }

        private DatabaseClient.GenericExecuteSpec bindNotificationContext(
                        DatabaseClient.GenericExecuteSpec spec,
                        Long cardId,
                        Long workspaceId,
                        Long boardId,
                        String actionToken) {
                DatabaseClient.GenericExecuteSpec withCard = bindNullableLong(spec, PARAM_CARD_ID, cardId);
                DatabaseClient.GenericExecuteSpec withWorkspace = bindNullableLong(withCard, PARAM_WORKSPACE_ID,
                                workspaceId);
                DatabaseClient.GenericExecuteSpec withBoard = bindNullableLong(withWorkspace, PARAM_BOARD_ID, boardId);
                return bindNullableString(withBoard, PARAM_ACTION_TOKEN, actionToken);
        }

        private DatabaseClient.GenericExecuteSpec bindNullableLong(
                        DatabaseClient.GenericExecuteSpec spec,
                        String paramName,
                        Long value) {
                return value != null ? spec.bind(paramName, value) : spec.bindNull(paramName, Long.class);
        }

        private DatabaseClient.GenericExecuteSpec bindNullableString(
                        DatabaseClient.GenericExecuteSpec spec,
                        String paramName,
                        String value) {
                return value != null ? spec.bind(paramName, value) : spec.bindNull(paramName, String.class);
        }

        private void pushRealtimeNotification(
                        Long userId,
                        String message,
                        NotificationType type,
                        Long cardId,
                        Long workspaceId,
                        Long boardId) {
                LocalDateTime now = LocalDateTime.now();
                try {
                        String json = String.format(
                                        "{\"type\":\"%s\",\"message\":\"%s\",\"cardId\":%s,\"workspaceId\":%s,\"boardId\":%s,\"isRead\":false,\"createdAt\":\"%s\"}",
                                        type.name(),
                                        escapeJson(message),
                                        cardId != null ? cardId : "null",
                                        workspaceId != null ? workspaceId : "null",
                                        boardId != null ? boardId : "null",
                                        now);
                        webSocketHandler.sendToUser(userId, json);

                        NotificationResponseDTO sseDto = NotificationResponseDTO
                                        .builder()
                                        .userId(userId)
                                        .message(message)
                                        .type(type)
                                        .cardId(cardId)
                                        .workspaceId(workspaceId)
                                        .boardId(boardId)
                                        .isRead(false)
                                        .createdAt(now)
                                        .build();
                        sseSink.tryEmitNext(sseDto);
                } catch (Exception e) {
                        log.warn("WebSocket push failed for user {}: {}", userId, e.getMessage());
                }
        }

        /**
         * Retrieves the user's notification list, ordered by most recent.
         */
        public Flux<NotificationResponseDTO> getUserNotifications(Long userId) {
                return databaseClient
                                .sql("SELECT id, card_id, workspace_id, board_id, message, type, action_token, IF(is_read, 1, 0) AS is_read, created_at "
                                                + "FROM notifications WHERE user_id = :userId "
                                                + "ORDER BY created_at DESC")
                                .bind(PARAM_USER_ID, userId)
                                .map((row, metadata) -> NotificationResponseDTO.builder()
                                                .id(parseLongValue(row.get("id")))
                                                .userId(userId)
                                                .message((String) row.get("message"))
                                                .type(parseNotificationType(row.get("type")))
                                                .actionToken(parseStringValue(row.get("action_token")))
                                                .cardId(parseLongValue(row.get("card_id")))
                                                .workspaceId(parseLongValue(row.get("workspace_id")))
                                                .boardId(parseLongValue(row.get("board_id")))
                                                .isRead(parseBooleanValue(row.get("is_read")))
                                                .createdAt(parseDateTimeValue(row.get("created_at")))
                                                .build())
                                .all()
                                .onErrorResume(error -> {
                                        log.error("SQL read failed for notifications user {}. Trying repository fallback: {}",
                                                        userId,
                                                        error.getMessage(), error);
                                        return notificationRepository.findAllByUserIdOrderByCreatedAtDesc(userId)
                                                        .map(this::mapToResponseDTO)
                                                        .onErrorResume(repoError -> {
                                                                log.error("Repository read also failed for user {}: {}",
                                                                                userId, repoError.getMessage(),
                                                                                repoError);
                                                                return Flux.<NotificationResponseDTO>empty();
                                                        });
                                });
        }

        /**
         * Updates a notification's status to read.
         */
        public Mono<Void> markAsRead(Long notificationId, Long userId) {
                return databaseClient
                                .sql("UPDATE notifications SET is_read = TRUE WHERE id = :notificationId AND user_id = :userId")
                                .bind(PARAM_NOTIFICATION_ID, notificationId)
                                .bind(PARAM_USER_ID, userId)
                                .fetch()
                                .rowsUpdated()
                                .flatMap(rows -> {
                                        if (rows > 0) {
                                                return Mono.empty();
                                        }
                                        return Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                        "Notification not found"));
                                });
        }

        /**
         * Bulk updates unread notifications to read for a user.
         */
        public Mono<Void> markAllAsRead(Long userId) {
                return databaseClient
                                .sql("UPDATE notifications SET is_read = TRUE WHERE user_id = :userId AND is_read = FALSE")
                                .bind(PARAM_USER_ID, userId)
                                .fetch()
                                .rowsUpdated()
                                .then();
        }

        /**
         * Returns a Flux that emits notifications for a specific user via SSE.
         */
        public Flux<NotificationResponseDTO> getSseFlux(String token) {
                try {
                        Long userId = Long.parseLong(jwtService.extractUserId(token));
                        return sseSink.asFlux()
                                        .filter(dto -> userId.equals(dto.getUserId()))
                                        .doOnSubscribe(sub -> log.info("📡 User {} subscribed to SSE", userId));
                } catch (Exception e) {
                        return Flux.error(e);
                }
        }

        /**
         * Deletes a notification from the system.
         */
        public Mono<Void> deleteNotification(Long notificationId, Long userId) {
                return databaseClient
                                .sql("DELETE FROM notifications WHERE id = :notificationId AND user_id = :userId")
                                .bind(PARAM_NOTIFICATION_ID, notificationId)
                                .bind(PARAM_USER_ID, userId)
                                .fetch()
                                .rowsUpdated()
                                .flatMap(rows -> {
                                        if (rows > 0) {
                                                return Mono.empty();
                                        }
                                        return Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                        "Notification not found"));
                                });
        }

        /**
         * Converts a Notification entity to a response DTO.
         */
        private NotificationResponseDTO mapToResponseDTO(Notification notification) {
                return NotificationResponseDTO.builder()
                                .id(notification.getId())
                                .userId(notification.getUserId())
                                .message(notification.getMessage())
                                .type(notification.getType())
                                .actionToken(notification.getActionToken())
                                .cardId(notification.getCardId())
                                .workspaceId(notification.getWorkspaceId())
                                .boardId(notification.getBoardId())
                                .isRead(notification.isRead())
                                .createdAt(notification.getCreatedAt())
                                .build();
        }

        /**
         * Utility method for robustly parsing raw database results into
         * NotificationType.
         */
        private NotificationType parseNotificationType(Object rawType) {
                if (rawType instanceof NotificationType notificationType) {
                        return notificationType;
                }
                if (rawType instanceof byte[] rawBytes) {
                        String typeName = new String(rawBytes).trim();
                        try {
                                return NotificationType.valueOf(typeName);
                        } catch (IllegalArgumentException ex) {
                                log.warn("Unknown notification type bytes '{}', defaulting to WORKSPACE_INVITATION",
                                                typeName);
                                return NotificationType.WORKSPACE_INVITATION;
                        }
                }
                if (rawType instanceof String typeName) {
                        try {
                                return NotificationType.valueOf(typeName);
                        } catch (IllegalArgumentException ex) {
                                log.warn("Unknown notification type '{}', defaulting to WORKSPACE_INVITATION",
                                                typeName);
                        }
                }
                return NotificationType.WORKSPACE_INVITATION;
        }

        /**
         * Utility method for robustly parsing raw database results into Boolean.
         */
        private Boolean parseBooleanValue(Object raw) {
                if (raw instanceof Boolean bool) {
                        return bool;
                }
                if (raw instanceof byte[] bytes) {
                        return bytes.length > 0 && bytes[0] != 0;
                }
                if (raw instanceof Number number) {
                        return number.intValue() != 0;
                }
                if (raw instanceof String str) {
                        String normalized = str.trim().toLowerCase();
                        return "1".equals(normalized) || "true".equals(normalized);
                }
                return false;
        }

        /**
         * Utility method for robustly parsing raw database results into String.
         */
        private String parseStringValue(Object raw) {
                if (raw == null) {
                        return null;
                }
                if (raw instanceof String str) {
                        return str;
                }
                if (raw instanceof byte[] bytes) {
                        return new String(bytes);
                }
                return String.valueOf(raw);
        }

        /**
         * Utility method for robustly parsing raw database results into Long.
         */
        private Long parseLongValue(Object raw) {
                if (raw == null) {
                        return null;
                }
                if (raw instanceof Long longValue) {
                        return longValue;
                }
                if (raw instanceof Number number) {
                        return number.longValue();
                }
                if (raw instanceof String str) {
                        try {
                                return Long.parseLong(str.trim());
                        } catch (NumberFormatException ex) {
                                return null;
                        }
                }
                return null;
        }

        /**
         * Utility method for robustly parsing raw database results into LocalDateTime.
         */
        private LocalDateTime parseDateTimeValue(Object raw) {
                if (raw == null) {
                        return null;
                }
                if (raw instanceof LocalDateTime dateTime) {
                        return dateTime;
                }
                if (raw instanceof OffsetDateTime offsetDateTime) {
                        return offsetDateTime.toLocalDateTime();
                }
                if (raw instanceof Timestamp timestamp) {
                        return timestamp.toLocalDateTime();
                }
                if (raw instanceof Instant instant) {
                        return LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
                }
                if (raw instanceof LocalDate localDate) {
                        return localDate.atStartOfDay();
                }
                if (raw instanceof java.util.Date date) {
                        return LocalDateTime.ofInstant(date.toInstant(), ZoneId.systemDefault());
                }
                if (raw instanceof byte[] bytes) {
                        return parseDateTimeString(new String(bytes).trim());
                }
                if (raw instanceof String str) {
                        return parseDateTimeString(str.trim());
                }
                return null;
        }

        private LocalDateTime parseDateTimeString(String raw) {
                if (raw == null || raw.isEmpty()) {
                        return null;
                }

                LocalDateTime local = tryParseDateTime(() -> LocalDateTime.parse(raw));
                if (local != null) {
                        return local;
                }

                LocalDateTime offset = tryParseDateTime(() -> OffsetDateTime.parse(raw).toLocalDateTime());
                if (offset != null) {
                        return offset;
                }

                LocalDateTime instant = tryParseDateTime(
                                () -> Instant.parse(raw).atZone(ZoneId.systemDefault()).toLocalDateTime());
                if (instant != null) {
                        return instant;
                }

                String normalizedSqlValue = raw.replace('T', ' ');
                return tryParseDateTime(() -> Timestamp.valueOf(normalizedSqlValue).toLocalDateTime());
        }

        private LocalDateTime tryParseDateTime(Supplier<LocalDateTime> parser) {
                try {
                        return parser.get();
                } catch (RuntimeException ex) {
                        return null;
                }
        }
}
