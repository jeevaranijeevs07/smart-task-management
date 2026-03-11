/**
 * Project: Smart Task Management
 * Component: SSE Controller
 * Description: Provides a Server-Sent Events (SSE) endpoint for real-time updates.
 */
package com.smarttask.notification.controller;

import com.smarttask.notification.dto.NotificationResponseDTO;
import com.smarttask.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api/sse")
@RequiredArgsConstructor
@Slf4j
public class SseController {

    private final NotificationService notificationService;

    /**
     * Establishes an SSE connection for a specific user to receive real-time
     * updates.
     * Authenticates via a token passed as a query parameter.
     */
    @GetMapping(value = "/updates", produces = "text/event-stream")
    public Flux<ServerSentEvent<NotificationResponseDTO>> streamUpdates(@RequestParam String token) {
        // Note: Token validation logic should ideally be handled by a security filter,
        // but for SSE simplicity, we can also resolve user inside the stream if needed.
        // For now, we'll delegate the stream creation to the service.
        return notificationService.getSseFlux(token)
                .map(notification -> ServerSentEvent.<NotificationResponseDTO>builder()
                        .data(notification)
                        .event("notification")
                        .build())
                .doOnSubscribe(subscription -> log.info("📡 SSE connection established via token"))
                .doFinally(signalType -> log.info("📡 SSE connection closed: {}", signalType));
    }
}
