/**
 * Project: Smart Task Management
 * Component: Notification Controller
 * Description: Manages user notifications, including retrieval, marking as read, and deletion.
 */
package com.smarttask.notification.controller;

import com.smarttask.notification.dto.NotificationResponseDTO;
import com.smarttask.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    /**
     * Extracts and validates the authenticated user's ID from the security context.
     */
    private Long resolveUserId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        try {
            return Long.parseLong(authentication.getName());
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid authenticated user");
        }
    }

    /**
     * Fetches all notifications for the currently logged-in user.
     */
    @GetMapping
    public Flux<NotificationResponseDTO> getUserNotifications(Authentication authentication) {
        Long userId = resolveUserId(authentication);
        return notificationService.getUserNotifications(userId);
    }

    /**
     * Marks a specific notification as read.
     */
    @PutMapping("/{id}/read")
    public Mono<java.util.Map<String, String>> markAsRead(
            @PathVariable Long id,
            Authentication authentication) {
        Long userId = resolveUserId(authentication);
        return notificationService.markAsRead(id, userId)
                .then(Mono.just(java.util.Map.of("message", "Notification marked as read")));
    }

    /**
     * Marks all of a user's notifications as read at once.
     */
    @PutMapping("/read-all")
    public Mono<java.util.Map<String, String>> markAllAsRead(Authentication authentication) {
        Long userId = resolveUserId(authentication);
        return notificationService.markAllAsRead(userId)
                .then(Mono.just(java.util.Map.of("message", "All notifications marked as read")));
    }

    /**
     * Permanently removes a specific notification.
     */
    @DeleteMapping("/{id}")
    public Mono<java.util.Map<String, String>> deleteNotification(
            @PathVariable Long id,
            Authentication authentication) {
        Long userId = resolveUserId(authentication);
        return notificationService.deleteNotification(id, userId)
                .then(Mono.just(java.util.Map.of("message", "Notification deleted")));
    }
}
