/**
 * Project: Smart Task Management
 * Layer: Entity (Database Model)
 * Component: User
 * Description: Represents the database schema for the component.
 */
package com.smarttask.activity.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;
import org.springframework.data.relational.core.mapping.Column;
import lombok.*;

import java.time.LocalDateTime;

@Table("activity_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ActivityLog {

    @Id
    private Long id;

    @Column("workspace_id")
    private Long workspaceId;

    @Column("card_id")
    private Long cardId;

    @Column("user_id")
    private Long userId;

    private String action;

    private String description;

    @Column("created_at")
    private LocalDateTime createdAt;
}
