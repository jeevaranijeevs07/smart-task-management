/**
 * Project: Smart Task Management
 * Layer: DTO (Data Transfer Object)
 * Component: User
 * Description: Data transfer object for API request/response.
 */
package com.smarttask.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateProfileRequest {

    @NotBlank(message = "Name is required")
    @Size(min = 2, max = 50, message = "Name must be between 2 and 50 characters")
    @Pattern(regexp = "^[A-Za-z][A-Za-z\\s'\\-]*$", message = "Name can only contain letters, spaces, apostrophes, and hyphens")
    private String name;

    @Size(max = 512, message = "Avatar URL must be at most 512 characters")
    @Pattern(regexp = "^(https?://.*)?$", message = "Avatar URL must be a valid http or https URL")
    private String avatarUrl;
}

