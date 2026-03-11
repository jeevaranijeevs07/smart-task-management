/**
 * Project: Smart Task Management
 * Component: Workspace Invitation Service
 * Description: Manages the lifecycle of workspace invitations, including creation, sending emails, and accepting invitations.
 */
package com.smarttask.workspace.service;

import com.smarttask.user.entity.User;
import com.smarttask.workspace.entity.WorkspaceMember;
import com.smarttask.workspace.entity.WorkspaceInvitation;
import com.smarttask.common.entities.enums.InvitationStatus;
import com.smarttask.common.entities.enums.NotificationType;
import com.smarttask.user.repository.UserRepository;
import com.smarttask.workspace.repository.WorkspaceMemberRepository;
import com.smarttask.notification.service.NotificationService;
import com.smarttask.notification.service.EmailService;
import com.smarttask.workspace.dto.InviteMemberRequestDTO;
import com.smarttask.workspace.repository.WorkspaceInvitationRepository;
import com.smarttask.workspace.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class WorkspaceInvitationService {

        private final WorkspaceInvitationRepository invitationRepository;
        private final WorkspaceRepository workspaceRepository;
        private final WorkspaceMemberRepository workspaceMemberRepository;
        private final UserRepository userRepository;
        private final NotificationService notificationService;
        private final EmailService emailService;
        private final DatabaseClient databaseClient;
        @Value("${app.frontend-base-url:http://localhost:5173}")
        private String frontendBaseUrl;

        /**
         * Initiates an invitation to a workspace for a user by email.
         */
        public Mono<Void> inviteMember(Long workspaceId, Long invitedBy, InviteMemberRequestDTO request) {
                return workspaceRepository.findById(workspaceId)
                                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Workspace not found")))
                                .flatMap(workspace -> {
                                        String normalizedEmail = request.getEmail().trim().toLowerCase();
                                        return userRepository
                                                        .findByEmailIgnoreCase(normalizedEmail)
                                                        .flatMap(user -> workspaceMemberRepository
                                                                        .existsByWorkspaceIdAndUserId(
                                                                                        workspaceId,
                                                                                        user.getId())
                                                                        .flatMap(isMember -> {
                                                                                if (Boolean.TRUE.equals(isMember)) {
                                                                                        return Mono.error(
                                                                                                        new ResponseStatusException(
                                                                                                                        HttpStatus.BAD_REQUEST,
                                                                                                                        "User is already a workspace member"));
                                                                                }
                                                                                return createAndSendInvitation(
                                                                                                workspaceId,
                                                                                                invitedBy,
                                                                                                normalizedEmail,
                                                                                                request.getRole(),
                                                                                                workspace.getName(),
                                                                                                user.getId())
                                                                                                .thenReturn(user);
                                                                        }))
                                                        .switchIfEmpty(Mono.defer(() -> createAndSendInvitation(
                                                                        workspaceId,
                                                                        invitedBy,
                                                                        normalizedEmail,
                                                                        request.getRole(),
                                                                        workspace.getName(),
                                                                        null).thenReturn(new User())))
                                                        .then();
                                })
                                .doOnError(error -> log.error("Invitation flow failed for workspace {}: {}",
                                                workspaceId,
                                                error.getMessage(), error))
                                .onErrorMap(error -> {
                                        if (error instanceof ResponseStatusException) {
                                                return error;
                                        }
                                        return new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                                                        "Invitation flow failed. Check backend logs for details.",
                                                        error);
                                })
                                .then();
        }

        /**
         * Processes an invitation acceptance using a unique token.
         */
        public Mono<Void> acceptInvitation(String token, Long userId) {
                log.info("Attempting to accept invitation with token: {} for user: {}", token, userId);
                return invitationRepository.findByToken(token)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                                "Invalid or expired invitation token")))
                                .flatMap(invitation -> {
                                        log.info("Invitation found: {} for email: {}", invitation.getId(),
                                                        invitation.getEmail());
                                        if (invitation.getStatus() != InvitationStatus.PENDING) {
                                                return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                                                "Invitation is already " + invitation.getStatus()));
                                        }

                                        return userRepository.findById(userId)
                                                        .flatMap(user -> {
                                                                String normalizedUserEmail = user.getEmail().trim()
                                                                                .toLowerCase();
                                                                String normalizedInviteEmail = invitation.getEmail()
                                                                                .trim().toLowerCase();

                                                                if (!normalizedUserEmail
                                                                                .equals(normalizedInviteEmail)) {
                                                                        log.warn("Email mismatch: user={} invite={}",
                                                                                        normalizedUserEmail,
                                                                                        normalizedInviteEmail);
                                                                        return Mono.error(new ResponseStatusException(
                                                                                        HttpStatus.FORBIDDEN,
                                                                                        "This invitation was sent to "
                                                                                                        + invitation.getEmail()));
                                                                }

                                                                return workspaceMemberRepository
                                                                                .existsByWorkspaceIdAndUserId(
                                                                                                invitation.getWorkspaceId(),
                                                                                                userId)
                                                                                .flatMap(isMember -> {
                                                                                        invitation.setStatus(
                                                                                                        InvitationStatus.ACCEPTED);
                                                                                        if (Boolean.TRUE.equals(
                                                                                                        isMember)) {
                                                                                                log.info("User {} is already a member of workspace {}. Updating invitation only.",
                                                                                                                userId,
                                                                                                                invitation.getWorkspaceId());
                                                                                                return databaseClient
                                                                                                                .sql("UPDATE workspace_invitations SET status = :status, updated_at = NOW() WHERE id = :id")
                                                                                                                .bind("status", InvitationStatus.ACCEPTED
                                                                                                                                .name())
                                                                                                                .bind("id", invitation
                                                                                                                                .getId())
                                                                                                                .fetch()
                                                                                                                .rowsUpdated()
                                                                                                                .then(sendPostAcceptNotification(
                                                                                                                                userId,
                                                                                                                                invitation.getWorkspaceId()));
                                                                                        }

                                                                                        log.info("Adding user {} to workspace {} as {}",
                                                                                                        userId,
                                                                                                        invitation.getWorkspaceId(),
                                                                                                        invitation.getRole());
                                                                                        WorkspaceMember member = WorkspaceMember
                                                                                                        .builder()
                                                                                                        .workspaceId(
                                                                                                                        invitation.getWorkspaceId())
                                                                                                        .userId(userId)
                                                                                                        .role(invitation
                                                                                                                        .getRole())
                                                                                                        .build();

                                                                                        return databaseClient.sql(
                                                                                                        "INSERT INTO workspace_members (workspace_id, user_id, role, created_at, updated_at) VALUES (:workspaceId, :userId, :role, NOW(), NOW())")
                                                                                                        .bind("workspaceId",
                                                                                                                        member.getWorkspaceId())
                                                                                                        .bind("userId", member
                                                                                                                        .getUserId())
                                                                                                        .bind("role", member
                                                                                                                        .getRole()
                                                                                                                        .name())
                                                                                                        .fetch()
                                                                                                        .rowsUpdated()
                                                                                                        .then(databaseClient
                                                                                                                        .sql("UPDATE workspace_invitations SET status = :status, updated_at = NOW() WHERE id = :id")
                                                                                                                        .bind("status", InvitationStatus.ACCEPTED
                                                                                                                                        .name())
                                                                                                                        .bind("id", invitation
                                                                                                                                        .getId())
                                                                                                                        .fetch()
                                                                                                                        .rowsUpdated())
                                                                                                        .then(sendPostAcceptNotification(
                                                                                                                        userId,
                                                                                                                        invitation.getWorkspaceId()));
                                                                                });
                                                        });
                                })
                                .doOnError(error -> {
                                        log.error("Failed to accept invitation token {}: {}", token, error.getMessage(),
                                                        error);
                                        try {
                                                java.io.PrintWriter pw = new java.io.PrintWriter(
                                                                new java.io.FileWriter("custom_500_debug.log", true));
                                                pw.println("--- ERROR ACCEPTING INVITATION ---");
                                                error.printStackTrace(pw);
                                                pw.close();
                                        } catch (Exception e) {
                                        }
                                })
                                .onErrorMap(error -> {
                                        if (error instanceof ResponseStatusException) {
                                                return error;
                                        }
                                        return new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                                                        "Accept invitation failed. Please try again or contact support.",
                                                        error);
                                })
                                .then();
        }

        /**
         * Automatically accepts any pending invitations for a user after they sign up.
         */
        public Mono<Void> handleAutoAcceptAfterSignup(User user) {
                return invitationRepository.findAllByEmail(user.getEmail().trim().toLowerCase())
                                .filter(invitation -> invitation.getStatus() == InvitationStatus.PENDING)
                                .flatMap(invitation -> {
                                        return workspaceMemberRepository
                                                        .existsByWorkspaceIdAndUserId(invitation.getWorkspaceId(),
                                                                        user.getId())
                                                        .flatMap(isMember -> {
                                                                invitation.setStatus(InvitationStatus.ACCEPTED);
                                                                if (Boolean.TRUE.equals(isMember)) {
                                                                        return databaseClient.sql(
                                                                                        "UPDATE workspace_invitations SET status = :status, updated_at = NOW() WHERE id = :id")
                                                                                        .bind("status", InvitationStatus.ACCEPTED
                                                                                                        .name())
                                                                                        .bind("id", invitation.getId())
                                                                                        .fetch().rowsUpdated()
                                                                                        .then(sendPostAcceptNotification(
                                                                                                        user.getId(),
                                                                                                        invitation.getWorkspaceId()));
                                                                }
                                                                WorkspaceMember member = WorkspaceMember.builder()
                                                                                .workspaceId(invitation
                                                                                                .getWorkspaceId())
                                                                                .userId(user.getId())
                                                                                .role(invitation.getRole())
                                                                                .build();
                                                                return databaseClient.sql(
                                                                                "INSERT INTO workspace_members (workspace_id, user_id, role, created_at, updated_at) VALUES (:workspaceId, :userId, :role, NOW(), NOW())")
                                                                                .bind("workspaceId",
                                                                                                member.getWorkspaceId())
                                                                                .bind("userId", member.getUserId())
                                                                                .bind("role", member.getRole().name())
                                                                                .fetch().rowsUpdated()
                                                                                .then(databaseClient.sql(
                                                                                                "UPDATE workspace_invitations SET status = :status, updated_at = NOW() WHERE id = :id")
                                                                                                .bind("status", InvitationStatus.ACCEPTED
                                                                                                                .name())
                                                                                                .bind("id", invitation
                                                                                                                .getId())
                                                                                                .fetch().rowsUpdated())
                                                                                .then(sendPostAcceptNotification(
                                                                                                user.getId(),
                                                                                                invitation.getWorkspaceId()));
                                                        });
                                }).then();
        }

        /**
         * Internal method to create an invitation record and send notifications/emails.
         */
        private Mono<Void> createAndSendInvitation(
                        Long workspaceId,
                        Long invitedBy,
                        String email,
                        com.smarttask.common.entities.enums.WorkspaceRole role,
                        String workspaceName,
                        Long existingUserId) {
                String token = UUID.randomUUID().toString();
                WorkspaceInvitation invitation = WorkspaceInvitation.builder()
                                .workspaceId(workspaceId)
                                .email(email)
                                .role(role)
                                .token(token)
                                .status(InvitationStatus.PENDING)
                                .invitedBy(invitedBy)
                                .build();

                String inviteLink = frontendBaseUrl + "/register?inviteToken=" + token;

                return userRepository.findById(invitedBy)
                                .map(inviter -> inviter.getName() != null ? inviter.getName() : "Someone")
                                .defaultIfEmpty("Someone")
                                .flatMap(inviterName -> {
                                        Mono<Void> recipientNotifyMono = existingUserId == null
                                                        ? Mono.empty()
                                                        : notificationService.createNotification(
                                                                        existingUserId,
                                                                        inviterName + " invited you to join '"
                                                                                        + workspaceName
                                                                                        + "'. Accept the invitation to start collaborating.",
                                                                        NotificationType.WORKSPACE_INVITATION,
                                                                        null,
                                                                        token,
                                                                        workspaceId,
                                                                        null).onErrorResume(error -> {
                                                                                log.warn("Notification creation failed for user {}: {}",
                                                                                                existingUserId,
                                                                                                error.getMessage());
                                                                                return Mono.empty();
                                                                        });
                                        Mono<Void> senderNotifyMono = notificationService.createNotification(
                                                        invitedBy,
                                                        "You invited " + email + " to join '" + workspaceName + "'.",
                                                        NotificationType.WORKSPACE_INVITATION,
                                                        null,
                                                        null,
                                                        workspaceId,
                                                        null).onErrorResume(error -> {
                                                                log.warn("Sender notification creation failed for user {}: {}",
                                                                                invitedBy, error.getMessage());
                                                                return Mono.empty();
                                                        });

                                        return persistInvitation(invitation)
                                                        .then(recipientNotifyMono)
                                                        .then(senderNotifyMono)
                                                        .then(emailService
                                                                        .sendInvitationEmail(email, workspaceName,
                                                                                        inviteLink)
                                                                        .onErrorResume(error -> {
                                                                                log.warn("Invitation email sending failed for {}: {}",
                                                                                                email,
                                                                                                error.getMessage());
                                                                                return Mono.empty();
                                                                        }));
                                });
        }

        /**
         * Persists an invitation to the database, with a SQL fallback if the repository
         * fails.
         */
        private Mono<Void> persistInvitation(WorkspaceInvitation invitation) {
                return invitationRepository.save(invitation)
                                .then()
                                .onErrorResume(error -> {
                                        log.warn("Invitation repository save failed, using SQL fallback: {}",
                                                        error.getMessage());
                                        return databaseClient
                                                        .sql("INSERT INTO workspace_invitations "
                                                                        + "(workspace_id, email, role, token, status, invited_by, created_at, updated_at) "
                                                                        + "VALUES (:workspaceId, :email, :role, :token, :status, :invitedBy, NOW(), NOW())")
                                                        .bind("workspaceId", invitation.getWorkspaceId())
                                                        .bind("email", invitation.getEmail())
                                                        .bind("role", invitation.getRole().name())
                                                        .bind("token", invitation.getToken())
                                                        .bind("status", invitation.getStatus().name())
                                                        .bind("invitedBy", invitation.getInvitedBy())
                                                        .fetch()
                                                        .rowsUpdated()
                                                        .flatMap(rows -> rows > 0 ? Mono.empty()
                                                                        : Mono.error(new ResponseStatusException(
                                                                                        HttpStatus.INTERNAL_SERVER_ERROR,
                                                                                        "Failed to save invitation")));
                                });
        }

        /**
         * Sends a notification to a user after they have successfully joined a
         * workspace.
         */
        private Mono<Void> sendPostAcceptNotification(Long userId, Long workspaceId) {
                return workspaceRepository.findById(workspaceId)
                                .map(workspace -> workspace.getName() == null ? "Workspace" : workspace.getName())
                                .defaultIfEmpty("Workspace")
                                .flatMap(workspaceName -> notificationService.createNotification(
                                                userId,
                                                "You've joined '" + workspaceName
                                                                + "'. Start collaborating with your team!",
                                                NotificationType.WORKSPACE_INVITATION,
                                                null,
                                                null,
                                                workspaceId,
                                                null))
                                .onErrorResume(error -> {
                                        log.warn("Post-accept notification failed for user {} workspace {}: {}",
                                                        userId, workspaceId, error.getMessage());
                                        return Mono.empty();
                                });
        }
}
