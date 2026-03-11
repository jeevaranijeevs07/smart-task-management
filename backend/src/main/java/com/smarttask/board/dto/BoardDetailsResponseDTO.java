/**
 * Project: Smart Task Management
 * Layer: DTO (Data Transfer Object)
 * Component: Board
 * Description: Data transfer object for API request/response.
 */
package com.smarttask.board.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BoardDetailsResponseDTO {
    private Long id;
    private String name;
    private String description;
    private Long workspaceId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String background;

    private List<BoardMemberDetailsDTO> members;
    private List<BoardListDetailsDTO> lists;
}
