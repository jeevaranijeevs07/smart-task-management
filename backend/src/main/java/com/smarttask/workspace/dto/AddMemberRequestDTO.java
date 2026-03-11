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
import jakarta.validation.constraints.NotNull;

import com.smarttask.common.entities.enums.WorkspaceRole;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddMemberRequestDTO {

    private Long userId;

    @NotNull(message = "Role cannot be null")
    private WorkspaceRole role;

}

