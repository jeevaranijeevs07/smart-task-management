/**
 * Project: Smart Task Management
 * Layer: Entity (Database Model)
 * Component: Board
 * Description: Represents the database schema for the component.
 */
package com.smarttask.board.entity;

import com.smarttask.common.entities.enums.BoardRole;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;
import lombok.*;
import java.time.LocalDateTime;

@Table("board_members")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BoardMember {
    @Id
    private Long id;

    @Column("board_id")
    private Long boardId;

    @Column("user_id")
    private Long userId;

    private BoardRole role;

    @Column("created_at")
    private LocalDateTime createdAt;

    @Column("updated_at")
    private LocalDateTime updatedAt;
}

