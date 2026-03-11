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

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkspaceResponseDTO {
    private Long id;
    private String name;
    private String description;
    private String role;
    private List<MemberDTO> members;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MemberDTO {
        private Long userId;
        private String role;
    }
}
