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

@Table("card_checklist_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CardChecklistItem {
    @Id
    private Long id;

    @Column("checklist_id")
    private Long checklistId;

    private String content;

    @Column("is_checked")
    private Boolean isChecked;

    private Integer position;

    @Column("created_at")
    private LocalDateTime createdAt;
}

