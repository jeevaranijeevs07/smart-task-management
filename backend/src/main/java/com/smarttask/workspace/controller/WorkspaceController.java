/**
 * Project: Smart Task Management
 * Component: Workspace Controller
 * Description: Manages workspace lifecycle, including creation, retrieval, updates, and member management.
 */
package com.smarttask.workspace.controller;

import com.smarttask.workspace.dto.AddMemberRequestDTO;
import com.smarttask.workspace.dto.WorkspaceRequestDTO;
import com.smarttask.workspace.dto.WorkspaceResponseDTO;
import com.smarttask.workspace.dto.WorkspaceMemberResponseDTO;
import com.smarttask.workspace.service.WorkspaceService;
import com.smarttask.workspace.dto.UpdateMemberRoleRequestDTO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/workspaces")
@RequiredArgsConstructor
public class WorkspaceController {

    private final WorkspaceService workspaceService;

    /**
     * Creates a new workspace.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<WorkspaceResponseDTO> createWorkspace(
            @Valid @RequestBody WorkspaceRequestDTO request,
            org.springframework.security.core.Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return workspaceService.createWorkspace(userId, request);
    }

    /**
     * Retrieves a workspace by its ID.
     */
    @GetMapping("/{id}")
    public Mono<WorkspaceResponseDTO> getWorkspaceById(@PathVariable Long id) {
        return workspaceService.getWorkspaceById(id);
    }

    /**
     * Retrieves all workspaces that the authenticated user belongs to.
     */
    @GetMapping
    public Flux<WorkspaceResponseDTO> getMyWorkspaces(
            org.springframework.security.core.Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return workspaceService.getWorkspacesByUserId(userId);
    }

    /**
     * Retrieves all workspaces for a specific user ID.
     */
    @GetMapping("/user/{userId}")
    public Flux<WorkspaceResponseDTO> getWorkspacesByUserId(@PathVariable Long userId) {
        return workspaceService.getWorkspacesByUserId(userId);
    }

    /**
     * Updates an existing workspace's details.
     */
    @PutMapping("/{id}")
    public Mono<WorkspaceResponseDTO> updateWorkspace(
            @PathVariable Long id,
            @Valid @RequestBody WorkspaceRequestDTO request,
            org.springframework.security.core.Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return workspaceService.updateWorkspace(id, userId, request);
    }

    /**
     * Deletes a workspace by its ID.
     */
    @DeleteMapping("/{id}")
    public Mono<java.util.Map<String, String>> deleteWorkspace(@PathVariable Long id,
            org.springframework.security.core.Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return workspaceService.deleteWorkspace(id, userId)
                .then(Mono.just(java.util.Map.of("message", "Workspace deleted successfully")));
    }

    /**
     * Retrieves all members of a specific workspace.
     */
    @GetMapping("/{id}/members")
    public Flux<WorkspaceMemberResponseDTO> getWorkspaceMembers(
            @PathVariable Long id,
            org.springframework.security.core.Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return workspaceService.getWorkspaceMembers(id, userId);
    }

    /**
     * Directly adds a member to a workspace (admin only).
     */
    @PostMapping("/{id}/members")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<WorkspaceResponseDTO> addMemberToWorkspace(
            @PathVariable Long id,
            @Valid @RequestBody AddMemberRequestDTO request,
            org.springframework.security.core.Authentication authentication) {
        Long adminId = Long.parseLong(authentication.getName());
        return workspaceService.addMemberToWorkspace(id, adminId, request);
    }

    /**
     * Updates the role of a member within a workspace (admin only).
     */
    @PutMapping("/{id}/members/{userId}/role")
    public Mono<WorkspaceResponseDTO> updateMemberRole(
            @PathVariable Long id,
            @PathVariable Long userId,
            @Valid @RequestBody UpdateMemberRoleRequestDTO request,
            org.springframework.security.core.Authentication authentication) {
        Long adminId = Long.parseLong(authentication.getName());
        return workspaceService.updateMemberRole(id, adminId, userId, request);
    }

    /**
     * Removes a member from a workspace (admin/self only).
     */
    @DeleteMapping("/{id}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> removeMember(
            @PathVariable Long id,
            @PathVariable Long userId,
            org.springframework.security.core.Authentication authentication) {
        Long adminId = Long.parseLong(authentication.getName());
        return workspaceService.removeMemberFromWorkspace(id, adminId, userId);
    }
}
