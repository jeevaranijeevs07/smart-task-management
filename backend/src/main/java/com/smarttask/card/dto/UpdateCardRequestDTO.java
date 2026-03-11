/**
 * Project: Smart Task Management
 * Layer: DTO (Data Transfer Object)
 * Component: Card
 * Description: Data transfer object for API request/response.
 */
package com.smarttask.card.dto;

import com.smarttask.card.entity.enums.CardPriority;
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
public class UpdateCardRequestDTO {
    private String title;
    private String description;
    private Long assignedTo;
    private CardPriority priority;
    private LocalDateTime dueDate;
    private Long boardListId;
    private List<String> labels;
}

