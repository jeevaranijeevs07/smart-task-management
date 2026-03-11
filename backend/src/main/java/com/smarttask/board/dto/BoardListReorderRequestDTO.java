/**
 * Project: Smart Task Management
 * Layer: DTO (Data Transfer Object)
 * Component: Board
 * Description: Data transfer object for API request/response.
 */
package com.smarttask.board.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BoardListReorderRequestDTO {

    @NotEmpty(message = "List of IDs cannot be empty")
    private List<Long> listIds;

}

