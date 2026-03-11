/**
 * Project: Smart Task Management
 * Layer: Entity (Database Model)
 * Component: User
 * Description: Represents the database schema for the component.
 */
package com.smarttask.notification.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;
import org.springframework.data.relational.core.mapping.Column;
import lombok.*;

import java.time.LocalDateTime;

import com.smarttask.common.entities.enums.NotificationType;

@Table("notifications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    private Long id;

    @Column("user_id")
    private Long userId;

    @Column("card_id")
    private Long cardId;

    @Column("workspace_id")
    private Long workspaceId;

    @Column("board_id")
    private Long boardId;

    private String message;

    private NotificationType type;

    @Column("action_token")
    private String actionToken;

    @Column("is_read")
    private boolean isRead;

    @Column("created_at")
    private LocalDateTime createdAt;
}
