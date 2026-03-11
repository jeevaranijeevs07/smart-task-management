/**
 * Project: Smart Task Management
 * Component: Deadline Notification Scheduler
 * Description: Periodically checks for cards with approaching deadlines
 *              and creates DUE_REMINDER notifications for assigned users.
 */
package com.smarttask.notification.scheduler;

import com.smarttask.card.repository.CardRepository;
import com.smarttask.common.entities.enums.NotificationType;
import com.smarttask.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
@Slf4j
public class DeadlineNotificationScheduler {

    private final CardRepository cardRepository;
    private final NotificationService notificationService;

    /**
     * Tracks card IDs that have already been notified in this JVM session
     * to prevent duplicate reminders on every scheduler run.
     */
    private final Set<Long> notifiedCardIds = ConcurrentHashMap.newKeySet();

    private static final DateTimeFormatter DISPLAY_FORMAT = DateTimeFormatter.ofPattern("MMM dd, yyyy hh:mm a");

    /**
     * Runs every 30 minutes. Finds cards with due dates within the next 24 hours
     * that have an assigned user, and creates DUE_REMINDER notifications.
     */
    @Scheduled(fixedRate = 1800000) // 30 minutes
    public void checkApproachingDeadlines() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime next24h = now.plusHours(24);

        log.info("⏰ Deadline check running — scanning cards due between {} and {}", now, next24h);

        cardRepository.findByDueDateBetweenAndAssignedToIsNotNull(now, next24h)
                .filter(card -> !notifiedCardIds.contains(card.getId()))
                .flatMap(card -> {
                    String dueFormatted = card.getDueDate().format(DISPLAY_FORMAT);
                    String message = String.format(
                            "⏰ Deadline approaching: \"%s\" is due on %s",
                            card.getTitle(), dueFormatted);

                    log.info("Creating DUE_REMINDER for card {} (assigned to user {})",
                            card.getId(), card.getAssignedTo());

                    notifiedCardIds.add(card.getId());

                    return notificationService.createNotification(
                            card.getAssignedTo(),
                            message,
                            NotificationType.DUE_REMINDER,
                            card.getId(),
                            card.getWorkspaceId(),
                            null);
                })
                .doOnComplete(() -> log.info("⏰ Deadline check complete."))
                .doOnError(err -> log.error("⏰ Deadline check error: {}", err.getMessage()))
                .subscribe();
    }

    /**
     * Runs daily at midnight to clear the notified set,
     * allowing cards to be re-notified if still approaching deadline.
     */
    @Scheduled(cron = "0 0 0 * * *")
    public void clearNotifiedCache() {
        int size = notifiedCardIds.size();
        notifiedCardIds.clear();
        log.info("🔄 Cleared {} notified card IDs from deadline cache.", size);
    }
}
