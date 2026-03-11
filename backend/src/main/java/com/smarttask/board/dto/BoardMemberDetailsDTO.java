/**
 * Project: Smart Task Management
 * Layer: DTO (Data Transfer Object)
 * Component: Board
 * Description: Data transfer object for API request/response.
 */
package com.smarttask.board.dto;

import com.smarttask.common.entities.enums.BoardRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BoardMemberDetailsDTO {
    private Long id;
    private Long boardId;
    private Long userId;
    private String name;
    private String email;
    private BoardRole role;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

