/**
 * Project: Smart Task Management
 * Layer: Entity (Database Model)
 * Component: Board
 * Description: Represents the database schema for the component.
 */
package com.smarttask.board.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;
import org.springframework.data.relational.core.mapping.Column;
import lombok.*;
import java.time.LocalDateTime;

@Table("board_lists")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BoardList {
    @Id
    private Long id;
    private String name;
    @Column("board_id")
    private Long boardId;
    private Integer position;
    @Column("created_at")
    private LocalDateTime createdAt;
    @Column("updated_at")
    private LocalDateTime updatedAt;
}

