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

@Table("card_labels")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CardLabel {

    @Id
    private Long id;

    @Column("card_id")
    private Long cardId;

    @Column("label_name")
    private String labelName;
}

