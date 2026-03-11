/**
 * Project: Smart Task Management
 * Layer: Entity (Database Model)
 * Component: Card
 * Description: Represents the database schema for the component.
 */
package com.smarttask.card.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;
import org.springframework.data.relational.core.mapping.Column;
import lombok.*;

import java.time.LocalDateTime;

import com.smarttask.card.entity.enums.CardPriority;

@Table("cards")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Card {

    @Id
    private Long id;

    private String title;

    private String description;

    @Column("workspace_id")
    private Long workspaceId;

    @Column("assigned_to")
    private Long assignedTo;

    private CardPriority priority;

    @Column("due_date")
    private LocalDateTime dueDate;

    @Column("parent_id")
    private Long parentId; // For subtasks

    @Column("board_list_id")
    private Long boardListId; // For Trello-like board lists

    @Column("created_by")
    private Long createdBy;

    @Column("created_at")
    private LocalDateTime createdAt;

    @Column("updated_at")
    private LocalDateTime updatedAt;
}
