package com.smarttask.workspace.service;

import com.smarttask.common.entities.enums.WorkspaceRole;
import com.smarttask.workspace.dto.AddMemberRequestDTO;
import com.smarttask.workspace.dto.WorkspaceRequestDTO;
import com.smarttask.workspace.dto.WorkspaceResponseDTO;
import com.smarttask.workspace.dto.UpdateMemberRoleRequestDTO;
import com.smarttask.workspace.entity.Workspace;
import com.smarttask.workspace.entity.WorkspaceMember;
import com.smarttask.workspace.repository.WorkspaceMemberRepository;
import com.smarttask.workspace.repository.WorkspaceRepository;
import com.smarttask.workspace.dto.WorkspaceMemberResponseDTO;
import com.smarttask.user.repository.UserRepository;
import com.smarttask.activity.service.ActivityLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class WorkspaceService {

        private final WorkspaceRepository workspaceRepository;
        private final WorkspaceMemberRepository workspaceMemberRepository;
        private final UserRepository userRepository;
        private final com.smarttask.board.repository.BoardRepository boardRepository;
        private final com.smarttask.board.repository.BoardMemberRepository boardMemberRepository;
        private final ActivityLogService activityLogService;

        private static int roleRank(WorkspaceRole role) {
                if (role == null) {
                        return -1;
                }
                if (role == WorkspaceRole.OWNER) {
                        return 3;
                }
                if (role == WorkspaceRole.ADMIN) {
                        return 2;
                }
                if (role == WorkspaceRole.MEMBER) {
                        return 1;
                }
                return 0; // VIEWER or unknown
        }

        private static long safeId(WorkspaceMember member) {
                return member.getId() == null ? Long.MAX_VALUE : member.getId();
        }

        private static WorkspaceMember pickEffectiveMembership(List<WorkspaceMember> memberships) {
                WorkspaceMember best = memberships.get(0);
                for (WorkspaceMember m : memberships) {
                        int bestRank = roleRank(best.getRole());
                        int candidateRank = roleRank(m.getRole());
                        if (candidateRank > bestRank) {
                                best = m;
                                continue;
                        }
                        if (candidateRank == bestRank && safeId(m) < safeId(best)) {
                                best = m;
                        }
                }
                return best;
        }

        private Mono<WorkspaceMember> findEffectiveMembership(Long workspaceId, Long userId) {
                return workspaceMemberRepository.findAllByWorkspaceIdAndUserId(workspaceId, userId)
                                .collectList()
                                .flatMap(list -> list.isEmpty() ? Mono.empty() : Mono.just(pickEffectiveMembership(list)));
        }

        public Mono<WorkspaceResponseDTO> createWorkspace(Long userId, WorkspaceRequestDTO request) {
                Workspace workspace = Workspace.builder()
                                .name(request.getName())
                                .description(request.getDescription())
                                .build();

                return workspaceRepository.save(workspace)
                                .flatMap(savedWorkspace -> {
                                        WorkspaceMember owner = WorkspaceMember.builder()
                                                        .workspaceId(savedWorkspace.getId())
                                                        .userId(userId)
                                                        .role(com.smarttask.common.entities.enums.WorkspaceRole.OWNER)
                                                        .build();
                                        return workspaceMemberRepository.save(owner)
                                                        .flatMap(savedMember -> activityLogService.logActivity(
                                                                        savedWorkspace.getId(),
                                                                        null,
                                                                        userId,
                                                                        "WORKSPACE_CREATED",
                                                                        "created the workspace: "
                                                                                        + savedWorkspace.getName())
                                                                        .then(populateMembers(savedWorkspace)));
                                });
        }

        public Mono<WorkspaceResponseDTO> getWorkspaceById(Long id) {
                return workspaceRepository.findById(id)
                                .flatMap(this::populateMembers);
        }

        public Flux<WorkspaceResponseDTO> getWorkspacesByUserId(Long userId) {
                return workspaceMemberRepository.findByUserId(userId)
                                .map(WorkspaceMember::getWorkspaceId)
                                .distinct()
                                .flatMap(this::getWorkspaceById);
        }

        public Flux<WorkspaceMemberResponseDTO> getWorkspaceMembers(Long workspaceId, Long userId) {
                return findEffectiveMembership(workspaceId, userId)
                                .switchIfEmpty(Mono.error(new org.springframework.web.server.ResponseStatusException(
                                                org.springframework.http.HttpStatus.FORBIDDEN,
                                                "User is not a member of the workspace")))
                                .thenMany(workspaceMemberRepository.findByWorkspaceId(workspaceId)
                                                .collectList()
                                                .flatMapMany(all -> {
                                                        Map<Long, WorkspaceMember> byUserId = new LinkedHashMap<>();
                                                        for (WorkspaceMember m : all) {
                                                                if (m.getUserId() == null) {
                                                                        continue;
                                                                }
                                                                WorkspaceMember existing = byUserId.get(m.getUserId());
                                                                if (existing == null) {
                                                                        byUserId.put(m.getUserId(), m);
                                                                        continue;
                                                                }
                                                                WorkspaceMember effective = pickEffectiveMembership(List.of(existing, m));
                                                                byUserId.put(m.getUserId(), effective);
                                                        }

                                                        List<WorkspaceMember> unique = new ArrayList<>(byUserId.values());
                                                        unique.sort((a, b) -> {
                                                                int r = Integer.compare(roleRank(b.getRole()), roleRank(a.getRole()));
                                                                if (r != 0) {
                                                                        return r;
                                                                }
                                                                return Long.compare(safeId(a), safeId(b));
                                                        });
                                                        return Flux.fromIterable(unique);
                                                }))
                                .flatMap(member -> userRepository.findById(member.getUserId())
                                                .map(user -> WorkspaceMemberResponseDTO.builder()
                                                                .id(member.getId())
                                                                .userId(user.getId())
                                                                .name(user.getName())
                                                                .email(user.getEmail())
                                                                .role(member.getRole().name())
                                                                .build()));
        }

        public Mono<WorkspaceResponseDTO> updateWorkspace(Long id, Long userId, WorkspaceRequestDTO request) {
                return checkWorkspacePrivileges(id, userId, true)
                                .then(workspaceRepository.findById(id))
                                .flatMap(workspace -> {
                                        workspace.setName(request.getName());
                                        workspace.setDescription(request.getDescription());
                                        return workspaceRepository.save(workspace);
                                })
                                .flatMap(this::populateMembers);
        }

        public Mono<Void> deleteWorkspace(Long id, Long userId) {
                return checkWorkspacePrivileges(id, userId, false)
                                .then(workspaceMemberRepository.findByWorkspaceId(id)
                                                .flatMap(member -> workspaceMemberRepository.delete(member))
                                                .then(workspaceRepository.deleteById(id)));
        }

        public Mono<WorkspaceResponseDTO> addMemberToWorkspace(Long workspaceId, Long adminId,
                        AddMemberRequestDTO request) {
                return checkWorkspacePrivileges(workspaceId, adminId, true)
                                .then(workspaceRepository.findById(workspaceId))
                                .switchIfEmpty(Mono.error(new org.springframework.web.server.ResponseStatusException(
                                                org.springframework.http.HttpStatus.NOT_FOUND, "Workspace not found")))
                                .flatMap(workspace -> userRepository.findById(request.getUserId())
                                        .flatMap(user -> {
                                            // Stricter duplicate check: block if any user with same email is already a member
                                            String normalizedEmail = user.getEmail().trim().toLowerCase();
                                            return workspaceMemberRepository.findByWorkspaceId(workspaceId)
                                                .flatMap(member -> userRepository.findById(member.getUserId()))
                                                .filter(existingUser -> existingUser.getEmail().trim().equalsIgnoreCase(normalizedEmail))
                                                .hasElements()
                                                .flatMap(duplicateExists -> {
                                                    if (duplicateExists) {
                                                        return Mono.<WorkspaceResponseDTO>error(
                                                            new org.springframework.web.server.ResponseStatusException(
                                                                org.springframework.http.HttpStatus.CONFLICT,
                                                                "A user with this email is already a member of the workspace"));
                                                    }
                                                    return workspaceMemberRepository
                                                        .existsByWorkspaceIdAndUserId(workspaceId, request.getUserId())
                                                        .flatMap(exists -> {
                                                            if (exists) {
                                                                return Mono.<WorkspaceResponseDTO>error(
                                                                    new org.springframework.web.server.ResponseStatusException(
                                                                        org.springframework.http.HttpStatus.CONFLICT,
                                                                        "User is already a member of this workspace"));
                                                            }
                                                            return Mono.defer(() -> {
                                                                WorkspaceMember member = WorkspaceMember.builder()
                                                                    .workspaceId(workspaceId)
                                                                    .userId(request.getUserId())
                                                                    .role(request.getRole())
                                                                    .build();
                                                                return workspaceMemberRepository.save(member)
                                                                    .flatMap(savedMember -> activityLogService.logActivity(
                                                                        workspaceId,
                                                                        null,
                                                                        adminId,
                                                                        "MEMBER_ADDED",
                                                                        "added user to workspace")
                                                                        .then(populateMembers(workspace)));
                                                            });
                                                        });
                                                });
                                        }));
        }

        public Mono<WorkspaceResponseDTO> updateMemberRole(Long workspaceId, Long adminId, Long targetUserId,
                        UpdateMemberRoleRequestDTO request) {
                return workspaceRepository.findById(workspaceId)
                                .switchIfEmpty(Mono.error(new org.springframework.web.server.ResponseStatusException(
                                                org.springframework.http.HttpStatus.NOT_FOUND, "Workspace not found")))
                                .flatMap(workspace -> findEffectiveMembership(workspaceId, adminId)
                                                .switchIfEmpty(Mono.error(
                                                                new org.springframework.web.server.ResponseStatusException(
                                                                                org.springframework.http.HttpStatus.FORBIDDEN,
                                                                                "Not a member")))
                                                .flatMap(adminMember -> workspaceMemberRepository
                                                                .findAllByWorkspaceIdAndUserId(workspaceId, targetUserId)
                                                                .collectList()
                                                                .flatMap(targetMemberships -> {
                                                                        if (targetMemberships.isEmpty()) {
                                                                                return Mono.error(
                                                                                                new org.springframework.web.server.ResponseStatusException(
                                                                                                                org.springframework.http.HttpStatus.NOT_FOUND,
                                                                                                                "Target user is not a member"));
                                                                        }

                                                                        WorkspaceMember targetEffective = pickEffectiveMembership(targetMemberships);
                                                                        WorkspaceRole adminRole = adminMember.getRole();
                                                                        WorkspaceRole targetNewRole = request.getRole();

                                                                        if (adminRole != WorkspaceRole.OWNER && adminRole != WorkspaceRole.ADMIN) {
                                                                                return Mono.error(
                                                                                                new org.springframework.web.server.ResponseStatusException(
                                                                                                                org.springframework.http.HttpStatus.FORBIDDEN,
                                                                                                                "Only Admins and Owners can update roles"));
                                                                        }

                                                                        if (adminRole == WorkspaceRole.ADMIN) {
                                                                                if (targetEffective.getRole() == WorkspaceRole.OWNER
                                                                                                || targetEffective.getRole() == WorkspaceRole.ADMIN) {
                                                                                        return Mono.error(
                                                                                                        new org.springframework.web.server.ResponseStatusException(
                                                                                                                        org.springframework.http.HttpStatus.FORBIDDEN,
                                                                                                                        "Admins cannot modify peer Admins or Owners"));
                                                                                }
                                                                                if (targetNewRole == WorkspaceRole.OWNER || targetNewRole == WorkspaceRole.ADMIN) {
                                                                                        return Mono.error(
                                                                                                        new org.springframework.web.server.ResponseStatusException(
                                                                                                                        org.springframework.http.HttpStatus.FORBIDDEN,
                                                                                                                        "Admins cannot promote users to Admin or Owner"));
                                                                                }
                                                                        }

                                                                        return Flux.fromIterable(targetMemberships)
                                                                                        .flatMap(m -> {
                                                                                                m.setRole(targetNewRole);
                                                                                                return workspaceMemberRepository.save(m);
                                                                                        })
                                                                                        .then(populateMembers(workspace));
                                                                })));
        }

        public Mono<Void> removeMemberFromWorkspace(Long workspaceId, Long adminId, Long targetUserId) {
                return findEffectiveMembership(workspaceId, adminId)
                                .switchIfEmpty(Mono.error(new org.springframework.web.server.ResponseStatusException(
                                                org.springframework.http.HttpStatus.FORBIDDEN, "Not a member")))
                                .flatMap(adminMember -> workspaceMemberRepository
                                                .findAllByWorkspaceIdAndUserId(workspaceId, targetUserId)
                                                .collectList()
                                                .flatMap(targetMemberships -> {
                                                        if (targetMemberships.isEmpty()) {
                                                                return Mono.error(
                                                                                new org.springframework.web.server.ResponseStatusException(
                                                                                                org.springframework.http.HttpStatus.NOT_FOUND,
                                                                                                "Target user is not a member"));
                                                        }

                                                        WorkspaceMember targetEffective = pickEffectiveMembership(targetMemberships);
                                                        WorkspaceRole adminRole = adminMember.getRole();

                                                        if (!adminId.equals(targetUserId)) {
                                                                if (adminRole != WorkspaceRole.OWNER && adminRole != WorkspaceRole.ADMIN) {
                                                                        return Mono.error(
                                                                                        new org.springframework.web.server.ResponseStatusException(
                                                                                                        org.springframework.http.HttpStatus.FORBIDDEN,
                                                                                                        "Only Admins and Owners can remove members"));
                                                                }

                                                                if (adminRole == WorkspaceRole.ADMIN
                                                                                && (targetEffective.getRole() == WorkspaceRole.OWNER
                                                                                                || targetEffective.getRole() == WorkspaceRole.ADMIN)) {
                                                                        return Mono.error(
                                                                                        new org.springframework.web.server.ResponseStatusException(
                                                                                                        org.springframework.http.HttpStatus.FORBIDDEN,
                                                                                                        "Admins cannot remove peer Admins or Owners"));
                                                                }
                                                        } else {
                                                                if (targetEffective.getRole() == WorkspaceRole.OWNER) {
                                                                        return workspaceMemberRepository
                                                                                        .findByWorkspaceId(workspaceId)
                                                                                        .filter(m -> m.getRole() == WorkspaceRole.OWNER)
                                                                                        .map(WorkspaceMember::getUserId)
                                                                                        .distinct()
                                                                                        .count()
                                                                                        .flatMap(count -> {
                                                                                                if (count <= 1) {
                                                                                                        return Mono.error(
                                                                                                                        new org.springframework.web.server.ResponseStatusException(
                                                                                                                                        org.springframework.http.HttpStatus.FORBIDDEN,
                                                                                                                                        "Cannot leave as the last owner of the workspace"));
                                                                                                }
                                                                                                return deleteMemberAndBoardMemberships(workspaceId, targetUserId, targetMemberships);
                                                                                        });
                                                                }
                                                        }

                                                        return deleteMemberAndBoardMemberships(workspaceId, targetUserId, targetMemberships);
                                                }));
        }

        private Mono<Void> deleteMemberAndBoardMemberships(Long workspaceId, Long userId, List<WorkspaceMember> memberships) {
                return boardRepository.findByWorkspaceId(workspaceId)
                                .flatMap(board -> boardMemberRepository
                                                .findByBoardIdAndUserId(board.getId(), userId)
                                                .flatMap(boardMemberRepository::delete))
                                .thenMany(Flux.fromIterable(memberships).flatMap(workspaceMemberRepository::delete))
                                .then();
        }

        private Mono<Void> checkWorkspacePrivileges(Long workspaceId, Long userId, boolean allowAdmin) {
                return findEffectiveMembership(workspaceId, userId)
                                .switchIfEmpty(Mono.error(new org.springframework.web.server.ResponseStatusException(
                                                org.springframework.http.HttpStatus.FORBIDDEN,
                                                "User is not a member of the workspace")))
                                .flatMap(member -> {
                                        if (member.getRole() == WorkspaceRole.OWNER) {
                                                return Mono.empty();
                                        }
                                        if (allowAdmin && member
                                                        .getRole() == WorkspaceRole.ADMIN) {
                                                return Mono.empty();
                                        }
                                        return Mono.error(new org.springframework.web.server.ResponseStatusException(
                                                        org.springframework.http.HttpStatus.FORBIDDEN,
                                                        "Insufficient privileges for this action"));
                                });
        }

        private Mono<WorkspaceResponseDTO> populateMembers(Workspace workspace) {
                return workspaceMemberRepository.findByWorkspaceId(workspace.getId())
                                .collectList()
                                .map(all -> {
                                        Map<Long, WorkspaceMember> byUserId = new LinkedHashMap<>();
                                        for (WorkspaceMember m : all) {
                                                if (m.getUserId() == null) {
                                                        continue;
                                                }
                                                WorkspaceMember existing = byUserId.get(m.getUserId());
                                                if (existing == null) {
                                                        byUserId.put(m.getUserId(), m);
                                                        continue;
                                                }
                                                WorkspaceMember effective = pickEffectiveMembership(List.of(existing, m));
                                                byUserId.put(m.getUserId(), effective);
                                        }

                                        List<WorkspaceResponseDTO.MemberDTO> members = new ArrayList<>();
                                        for (WorkspaceMember m : byUserId.values()) {
                                                members.add(WorkspaceResponseDTO.MemberDTO.builder()
                                                                .userId(m.getUserId())
                                                                .role(m.getRole().name())
                                                                .build());
                                        }

                                        return WorkspaceResponseDTO.builder()
                                                        .id(workspace.getId())
                                                        .name(workspace.getName())
                                                        .description(workspace.getDescription())
                                                        .members(members)
                                                        .build();
                                });
        }

}
