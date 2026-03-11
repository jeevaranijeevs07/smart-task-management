package com.smarttask.activity.service;

import com.smarttask.activity.dto.ActivityLogResponseDTO;
import com.smarttask.activity.entity.ActivityLog;
import com.smarttask.activity.repository.ActivityLogRepository;
import com.smarttask.user.repository.UserRepository;
import com.smarttask.workspace.repository.WorkspaceMemberRepository;
import com.smarttask.workspace.repository.WorkspaceRepository;
import com.smarttask.card.repository.CardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class ActivityLogService {

    private final ActivityLogRepository activityLogRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final CardRepository cardRepository;

    public Mono<Void> logActivity(Long workspaceId, Long cardId, Long userId, String action, String description) {
        ActivityLog log = ActivityLog.builder()
                .workspaceId(workspaceId)
                .cardId(cardId)
                .userId(userId)
                .action(action)
                .description(description)
                .createdAt(LocalDateTime.now())
                .build();
        return activityLogRepository.save(log).then();
    }

    public Flux<ActivityLogResponseDTO> getRecentActivitiesForUser(Long userId) {
        return workspaceMemberRepository.findByUserId(userId)
                .map(member -> member.getWorkspaceId())
                .distinct() // Avoid duplicates in IN clause
                .collectList()
                .flatMapMany(workspaceIds -> {
                    if (workspaceIds == null || workspaceIds.isEmpty()) {
                        return Flux.<ActivityLog>empty();
                    }
                    return activityLogRepository.findByWorkspaceIdInOrderByCreatedAtDesc(workspaceIds)
                            .take(20);
                })
                .flatMap(this::mapToResponseDTO);
    }

    private Mono<ActivityLogResponseDTO> mapToResponseDTO(ActivityLog log) {
        // Guard against null IDs to prevent R2DBC findById(null) exceptions
        Mono<String[]> userMono = log.getUserId() != null
                ? userRepository.findById(log.getUserId())
                        .map(u -> new String[] { u.getName(), u.getAvatarUrl() })
                        .defaultIfEmpty(new String[] { "Unknown User", null })
                : Mono.just(new String[] { "Unknown User", null });

        Mono<String> workspaceMono = log.getWorkspaceId() != null
                ? workspaceRepository.findById(log.getWorkspaceId())
                        .map(w -> w.getName())
                        .defaultIfEmpty("Unknown Workspace")
                : Mono.just("Unknown Workspace");

        Mono<String> cardMono = log.getCardId() != null
                ? cardRepository.findById(log.getCardId())
                        .map(c -> c.getTitle())
                        .defaultIfEmpty("Deleted Card")
                : Mono.just("");

        return Mono.zip(userMono, workspaceMono, cardMono)
                .map(tuple -> ActivityLogResponseDTO.builder()
                        .id(log.getId())
                        .workspaceId(log.getWorkspaceId())
                        .workspaceName(tuple.getT2())
                        .cardId(log.getCardId())
                        .cardTitle(tuple.getT3())
                        .userId(log.getUserId())
                        .userName(tuple.getT1()[0])
                        .userAvatar(tuple.getT1()[1])
                        .action(log.getAction())
                        .description(log.getDescription())
                        .createdAt(log.getCreatedAt())
                        .build());
    }
}
