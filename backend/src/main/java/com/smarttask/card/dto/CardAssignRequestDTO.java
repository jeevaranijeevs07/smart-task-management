/**
 * Project: Smart Task Management
 * Layer: DTO (Data Transfer Object)
 * Component: Card
 * Description: Request DTO for assigning a card to a user.
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
public class CardAssignRequestDTO {
    @NotNull(message = "User ID to assign is required")
    private Long userId;
}
