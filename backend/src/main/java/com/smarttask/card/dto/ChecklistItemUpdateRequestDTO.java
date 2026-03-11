/**
 * Project: Smart Task Management
 * Layer: DTO (Data Transfer Object)
 * Component: Card
 * Description: Data transfer object for API request/response.
 */
package com.smarttask.card.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChecklistItemUpdateRequestDTO {
    private String content;
    private Boolean isChecked;
}

