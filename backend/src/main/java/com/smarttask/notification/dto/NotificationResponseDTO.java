/**
 * Project: Smart Task Management
 * Layer: DTO (Data Transfer Object)
 * Component: User
 * Description: Data transfer object for API request/response.
 */
package com.smarttask.notification.dto;

import com.smarttask.common.entities.enums.NotificationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationResponseDTO {
    private Long id;
    private Long userId;
    private String message;
    private NotificationType type;
    private String actionToken;
    private Long cardId;
    private Long boardId;
    private Long workspaceId;
    private Boolean isRead;
    private LocalDateTime createdAt;
}
