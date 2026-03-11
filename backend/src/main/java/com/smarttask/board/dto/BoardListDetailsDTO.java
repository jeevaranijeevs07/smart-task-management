/**
 * Project: Smart Task Management
 * Layer: DTO (Data Transfer Object)
 * Component: Board
 * Description: Data transfer object for API request/response.
 */
package com.smarttask.board.dto;

import com.smarttask.card.dto.CardResponseDTO;
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
public class BoardListDetailsDTO {
    private Long id;
    private String name;
    private Long boardId;
    private Integer position;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<CardResponseDTO> cards;
}

