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

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BoardListRequestDTO {
    private String name;
    private Integer position;
}

