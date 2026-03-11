/**
 * Project: Smart Task Management
 * Layer: DTO (Data Transfer Object)
 * Component: Card
 * Description: Data transfer object for API request/response.
 */
package com.smarttask.card.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CardMoveRequestDTO {
    @NotNull(message = "Target board list ID is required")
    private Long boardListId;

    private Integer position;
}

