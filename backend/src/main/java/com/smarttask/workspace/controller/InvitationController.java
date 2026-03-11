/**
 * Project: Smart Task Management
 * Layer: Controller (API Layer)
 * Component: User
 * Description: Handles HTTP requests for the component.
 */
package com.smarttask.workspace.controller;

import com.smarttask.workspace.dto.InviteMemberRequestDTO;
import com.smarttask.workspace.service.WorkspaceInvitationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class InvitationController {

    private final WorkspaceInvitationService invitationService;

    /**
     * Invites a member to a workspace via email.
     */
    @PostMapping("/workspaces/{id}/invitations")
    public Mono<java.util.Map<String, String>> inviteMember(@PathVariable Long id,
            @Valid @RequestBody InviteMemberRequestDTO request,
            org.springframework.security.core.Authentication authentication) {
        Long adminId = Long.parseLong(authentication.getName());
        return invitationService.inviteMember(id, adminId, request)
                .then(Mono.just(java.util.Map.of("message", "Invitation sent successfully")));
    }

    /**
     * Accepts a workspace invitation using a token.
     */
    @PostMapping("/invitations/accept")
    public Mono<java.util.Map<String, String>> acceptInvitation(@RequestParam String token,
            org.springframework.security.core.Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return invitationService.acceptInvitation(token, userId)
                .then(Mono.just(java.util.Map.of("message", "Invitation accepted successfully")));
    }
}
