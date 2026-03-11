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

@Table("card_checklists")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CardChecklist {
    @Id
    private Long id;

    @Column("card_id")
    private Long cardId;

    private String name;

    private Integer position;

    @Column("created_at")
    private LocalDateTime createdAt;
}

