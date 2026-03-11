/**
 * Project: Smart Task Management
 * Layer: DTO (Data Transfer Object)
 * Component: User
 * Description: Data transfer object for API request/response.
 */
package com.smarttask.workspace.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import jakarta.validation.constraints.NotBlank;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkspaceRequestDTO {

    @NotBlank(message = "Workspace name cannot be empty")
    private String name;

    private String description;
}

