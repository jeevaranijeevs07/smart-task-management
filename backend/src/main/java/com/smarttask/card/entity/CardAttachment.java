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

@Table("card_attachments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CardAttachment {
    @Id
    private Long id;

    @Column("card_id")
    private Long cardId;

    @Column("user_id")
    private Long userId;

    @Column("file_name")
    private String fileName;

    @Column("file_url")
    private String fileUrl;

    @Column("file_type")
    private String fileType;

    @Column("created_at")
    private LocalDateTime createdAt;
}

