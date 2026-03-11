/**
 * Project: Smart Task Management
 * Component: WebSocket Notification Handler
 * Description: Manages per-user WebSocket sessions for real-time push notifications.
 *              Authenticates via JWT token passed as a query parameter.
 */
package com.smarttask.notification.websocket;

import com.smarttask.common.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationWebSocketHandler implements WebSocketHandler {

    private final JwtService jwtService;

    /**
     * Maps userId -> set of active WebSocket sessions (supports multiple
     * tabs/devices).
     */
    private final Map<Long, Set<WebSocketSession>> userSessions = new ConcurrentHashMap<>();

    @Override
    public Mono<Void> handle(WebSocketSession session) {
        // Extract JWT token from query parameter
        String query = session.getHandshakeInfo().getUri().getQuery();
        String token = extractToken(query);

        if (token == null) {
            log.warn("WebSocket connection rejected: no token provided");
            return session.close();
        }

        Long userId;
        try {
            userId = Long.parseLong(jwtService.extractUserId(token));
        } catch (Exception e) {
            log.warn("WebSocket connection rejected: invalid token — {}", e.getMessage());
            return session.close();
        }

        // Register session
        userSessions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(session);
        log.info("🔌 WebSocket connected: userId={} (sessions: {})", userId, userSessions.get(userId).size());

        // Keep connection alive by receiving (and discarding) any incoming messages
        return session.receive()
                .doFinally(signal -> {
                    Set<WebSocketSession> sessions = userSessions.get(userId);
                    if (sessions != null) {
                        sessions.remove(session);
                        if (sessions.isEmpty()) {
                            userSessions.remove(userId);
                        }
                    }
                    log.info("🔌 WebSocket disconnected: userId={}", userId);
                })
                .then();
    }

    /**
     * Sends a JSON message to all active sessions for a given user.
     */
    public void sendToUser(Long userId, String jsonPayload) {
        Set<WebSocketSession> sessions = userSessions.get(userId);
        if (sessions == null || sessions.isEmpty()) {
            return;
        }

        for (WebSocketSession session : sessions) {
            if (session.isOpen()) {
                session.send(Mono.just(session.textMessage(jsonPayload)))
                        .doOnError(
                                err -> log.warn("Failed to send WS message to userId={}: {}", userId, err.getMessage()))
                        .subscribe();
            }
        }
    }

    /**
     * Returns the number of connected users (for monitoring).
     */
    public int getConnectedUserCount() {
        return userSessions.size();
    }

    private String extractToken(String query) {
        if (query == null)
            return null;
        for (String param : query.split("&")) {
            String[] kv = param.split("=", 2);
            if (kv.length == 2 && "token".equals(kv[0])) {
                return kv[1];
            }
        }
        return null;
    }
}
