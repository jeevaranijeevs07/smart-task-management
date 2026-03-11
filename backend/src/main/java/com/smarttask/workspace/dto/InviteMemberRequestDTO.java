/**
 * Project: Smart Task Management
 * Layer: DTO (Data Transfer Object)
 * Component: Workspace
 * Description: Data transfer object for workspace invitation requests.
 */
package com.smarttask.workspace.dto;

import com.smarttask.common.entities.enums.WorkspaceRole;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InviteMemberRequestDTO {
    @NotBlank(message = "Email is required")
    @Email(message = "Please provide a valid email address")
    @Size(max = 254, message = "Email must be at most 254 characters")
    @Pattern(regexp = "^[A-Za-z0-9._%+-]+@gmail\\.com$", message = "Only Gmail addresses (@gmail.com) are allowed")
    private String email;

    @NotNull(message = "Role is required")
    private WorkspaceRole role;
}
