package com.smarttask.card.service;

import com.smarttask.card.dto.*;
import com.smarttask.card.entity.*;
import com.smarttask.card.repository.*;
import com.smarttask.board.repository.BoardListRepository;
import com.smarttask.board.repository.BoardRepository;
import com.smarttask.board.service.BoardService;
import com.smarttask.workspace.repository.WorkspaceMemberRepository;
import com.smarttask.common.entities.enums.NotificationType;
import com.smarttask.common.entities.enums.WorkspaceRole;
import com.smarttask.activity.service.ActivityLogService;
import com.smarttask.notification.service.NotificationService;
import com.smarttask.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class CardService {

        private final CardRepository cardRepository;
        private final CardLabelRepository cardLabelRepository;
        private final WorkspaceMemberRepository workspaceMemberRepository;
        private final BoardListRepository boardListRepository;
        private final BoardRepository boardRepository;
        private final BoardService boardService;

        // Rich feature repositories
        private final CardMemberRepository cardMemberRepository;
        private final CardChecklistRepository cardChecklistRepository;
        private final CardChecklistItemRepository cardChecklistItemRepository;
        private final CardCommentRepository cardCommentRepository;
        private final CardAttachmentRepository cardAttachmentRepository;
        private final ActivityLogService activityLogService;
        private final NotificationService notificationService;
        private final UserRepository userRepository;

        private static final Pattern MENTION_PATTERN = Pattern.compile("@\\[(.*?)]\\((\\d+)\\)");

        private static int wsRoleRank(WorkspaceRole role) {
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

        private Mono<WorkspaceRole> getEffectiveWorkspaceRole(Long workspaceId, Long userId) {
                return workspaceMemberRepository.findAllByWorkspaceIdAndUserId(workspaceId, userId)
                                .map(m -> m.getRole())
                                .collectList()
                                .flatMap(roles -> {
                                        if (roles.isEmpty()) {
                                                return Mono.error(new ResponseStatusException(
                                                                HttpStatus.FORBIDDEN,
                                                                "User is not a member of the workspace"));
                                        }
                                        WorkspaceRole best = roles.get(0);
                                        for (WorkspaceRole r : roles) {
                                                if (wsRoleRank(r) > wsRoleRank(best)) {
                                                        best = r;
                                                }
                                        }
                                        return Mono.just(best);
                                });
        }

        private Mono<Void> requireWorkspaceNonViewer(Long workspaceId, Long userId) {
                return getEffectiveWorkspaceRole(workspaceId, userId)
                                .flatMap(role -> {
                                        if (role == WorkspaceRole.VIEWER) {
                                                return Mono.error(new ResponseStatusException(
                                                                HttpStatus.FORBIDDEN,
                                                                "Workspace viewers cannot perform this action"));
                                        }
                                        return Mono.empty();
                                })
                                .then();
        }

        private Mono<Void> checkCardParticipantPrivilege(Card card, Long userId) {
                return getEffectiveWorkspaceRole(card.getWorkspaceId(), userId)
                                .flatMap(role -> {
                                        if (role == WorkspaceRole.OWNER || role == WorkspaceRole.ADMIN) {
                                                return Mono.empty();
                                        }
                                        if (role == WorkspaceRole.VIEWER) {
                                                return Mono.error(new ResponseStatusException(
                                                                HttpStatus.FORBIDDEN,
                                                                "Workspace viewers cannot perform this action"));
                                        }

                                        // Workspace MEMBER: allow if they are assigned or explicitly a card member.
                                        if (userId != null && userId.equals(card.getAssignedTo())) {
                                                return Mono.empty();
                                        }

                                        return cardMemberRepository.findAllByCardId(card.getId())
                                                        .filter(m -> m.getUserId() != null && m.getUserId().equals(userId))
                                                        .hasElements()
                                                        .flatMap(isCardMember -> {
                                                                if (Boolean.TRUE.equals(isCardMember)) {
                                                                        return Mono.empty();
                                                                }
                                                                return Mono.error(new ResponseStatusException(
                                                                                HttpStatus.FORBIDDEN,
                                                                                "You don't have permission to perform this action."));
                                                        });
                                })
                                .then();
        }

        private Mono<Void> validateAttachmentUrl(String fileUrl) {
                String raw = (fileUrl == null) ? "" : fileUrl.trim();
                if (raw.isEmpty()) {
                        return Mono.error(new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "fileUrl is required"));
                }

                try {
                        URI uri = new URI(raw);
                        String scheme = uri.getScheme();
                        if (scheme == null) {
                                return Mono.error(new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "fileUrl must be an absolute URL"));
                        }
                        String s = scheme.toLowerCase();
                        if (!"http".equals(s) && !"https".equals(s)) {
                                return Mono.error(new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "fileUrl must start with http:// or https://"));
                        }
                        if (uri.getHost() == null || uri.getHost().trim().isEmpty()) {
                                return Mono.error(new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "fileUrl must include a valid host"));
                        }
                        return Mono.empty();
                } catch (URISyntaxException e) {
                        return Mono.error(new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "fileUrl is not a valid URL"));
                }
        }

        public Mono<CardResponseDTO> createCard(Long workspaceId, Long userId, CreateCardRequestDTO request) {
                return boardListRepository.findById(request.getBoardListId())
                                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Board list not found")))
                                .flatMap(list -> {
                                        // Top-level cards require admin permission
                                        if (request.getParentId() == null) {
                                                return boardService.checkBoardAdmin(workspaceId, list.getBoardId(), userId);
                                        }
                                        // Sub-cards can be created by members
                                        return boardService.checkBoardMember(workspaceId, list.getBoardId(), userId);
                                })
                                .then(Mono.defer(() -> {
                                        Long assignedTo = request.getAssignedTo();
                                        if (assignedTo == null) {
                                                return Mono.empty();
                                        }
                                        return boardListRepository.findById(request.getBoardListId())
                                                        .flatMap(list -> checkAssigneeInWorkspace(workspaceId, assignedTo)
                                                                        .then(verifyUserCanAssign(
                                                                                        workspaceId,
                                                                                        list.getBoardId(),
                                                                                        userId,
                                                                                        assignedTo)));
                                }))
                                .then(Mono.defer(() -> {
                                        Card card = Card.builder()
                                                        .title(request.getTitle())
                                                        .description(request.getDescription())
                                                        .workspaceId(workspaceId)
                                                        .assignedTo(request.getAssignedTo())
                                                        .priority(request.getPriority())
                                                        .dueDate(request.getDueDate())
                                                        .parentId(request.getParentId())
                                                        .boardListId(request.getBoardListId())
                                                        .createdBy(userId)
                                                        .build();

                                        return cardRepository.save(card)
                                                        .flatMap(savedCard -> {
                                                                Mono<Void> notifyMono = Mono.empty();
                                                                if (savedCard.getAssignedTo() != null) {
                                                                        notifyMono = boardListRepository.findById(
                                                                                        savedCard.getBoardListId())
                                                                                        .flatMap(boardList -> notificationService
                                                                                                        .createNotification(
                                                                                                                        savedCard.getAssignedTo(),
                                                                                                                        "You have been assigned to task: "
                                                                                                                                        + savedCard.getTitle(),
                                                                                                                        NotificationType.CARD_ASSIGNED,
                                                                                                                        savedCard.getId(),
                                                                                                                        savedCard.getWorkspaceId(),
                                                                                                                        boardList.getBoardId()));
                                                                }

                                                                return notifyMono
                                                                                .then(activityLogService.logActivity(
                                                                                                workspaceId,
                                                                                                savedCard.getId(),
                                                                                                userId, "CARD_CREATED",
                                                                                                "created task: " + savedCard
                                                                                                                .getTitle()))
                                                                                .then(saveLabels(savedCard.getId(),
                                                                                                request.getLabels()))
                                                                                .then(mapToResponseDTO(savedCard));
                                                        });
                                }));
        }

        public Mono<CardResponseDTO> updateCard(Long cardId, Long userId, UpdateCardRequestDTO request) {
                return cardRepository.findById(cardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found")))
                                .flatMap(card -> boardListRepository.findById(card.getBoardListId())
                                                .flatMap(list -> boardService
                                                                .checkBoardMember(card.getWorkspaceId(),
                                                                                list.getBoardId(), userId)
                                                                .thenReturn(card)))
                                .flatMap(card -> {
                                        if (request.getAssignedTo() == null) {
                                                return Mono.just(card);
                                        }
                                        Long newAssignee = request.getAssignedTo();
                                        Long prevAssignee = card.getAssignedTo();
                                        boolean changed = (prevAssignee == null && newAssignee != null)
                                                        || (prevAssignee != null && !prevAssignee.equals(newAssignee));
                                        if (!changed) {
                                                return Mono.just(card);
                                        }
                                        return boardListRepository.findById(card.getBoardListId())
                                                        .flatMap(list -> checkAssigneeInWorkspace(card.getWorkspaceId(), newAssignee)
                                                                        .then(verifyUserCanAssign(
                                                                                        card.getWorkspaceId(),
                                                                                        list.getBoardId(),
                                                                                        userId,
                                                                                        newAssignee))
                                                                        .thenReturn(card));
                                })
                                .flatMap(card -> {
                                        if (request.getTitle() != null)
                                                card.setTitle(request.getTitle());
                                        if (request.getDescription() != null)
                                                card.setDescription(request.getDescription());
                                        if (request.getAssignedTo() != null)
                                                card.setAssignedTo(request.getAssignedTo());
                                        if (request.getPriority() != null)
                                                card.setPriority(request.getPriority());
                                        if (request.getDueDate() != null)
                                                card.setDueDate(request.getDueDate());

                                        return cardRepository.save(card)
                                                        .flatMap(savedCard -> activityLogService
                                                                        .logActivity(savedCard.getWorkspaceId(),
                                                                                        savedCard.getId(), userId,
                                                                                        "CARD_UPDATED",
                                                                                        "updated task details")
                                                                        .then(saveLabels(savedCard.getId(),
                                                                                        request.getLabels()))
                                                                        .then(mapToResponseDTO(savedCard)));
                                });
        }

        public Mono<Void> deleteCard(Long cardId, Long userId) {
                return cardRepository.findById(cardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found")))
                                .flatMap(card -> boardListRepository.findById(card.getBoardListId())
                                                .flatMap(list -> boardService
                                                                .checkBoardAdmin(card.getWorkspaceId(),
                                                                                list.getBoardId(), userId)
                                                                .thenReturn(card)))
                                .flatMap(card -> activityLogService
                                                .logActivity(card.getWorkspaceId(), card.getId(), userId,
                                                                "CARD_DELETED", "deleted task: " + card.getTitle())
                                                .then(cardRepository.delete(card)));
        }

        public Mono<CardResponseDTO> getCard(Long cardId, Long userId) {
                return cardRepository.findById(cardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found")))
                                .flatMap(card -> boardListRepository.findById(card.getBoardListId())
                                                .flatMap(list -> boardService
                                                                // Viewers should be able to read card details (read-only).
                                                                .checkBoardViewAccess(card.getWorkspaceId(),
                                                                                list.getBoardId(), userId)
                                                                .thenReturn(card)))
                                .flatMap(this::mapToResponseDTO);
        }

        public Flux<CardResponseDTO> getWorkspaceCards(Long workspaceId, Long userId) {
                return workspaceMemberRepository.findAllByWorkspaceIdAndUserId(workspaceId, userId)
                                .hasElements()
                                .flatMapMany(isMember -> {
                                        if (!Boolean.TRUE.equals(isMember)) {
                                                return Flux.error(new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                                "Not a member of this workspace"));
                                        }
                                        return cardRepository.findByWorkspaceId(workspaceId);
                                })
                                .flatMap(this::mapToResponseDTO);
        }

        public Mono<Void> assignUser(Long cardId, Long userId, CardAssignRequestDTO request) {
                return cardRepository.findById(cardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found")))
                                .flatMap(card -> boardListRepository.findById(card.getBoardListId())
                                                .flatMap(list -> boardService
                                                                // Assignment is a mutation, but your model allows
                                                                // workspace MEMBERS to self-assign even if they are not board members.
                                                                .checkBoardViewAccess(card.getWorkspaceId(),
                                                                                list.getBoardId(), userId)
                                                                .then(requireWorkspaceNonViewer(card.getWorkspaceId(), userId))
                                                                .then(checkAssigneeInWorkspace(card.getWorkspaceId(),
                                                                                request.getUserId()))
                                                                // Verify member can only assign themselves
                                                                .then(verifyUserCanAssign(card.getWorkspaceId(), 
                                                                                list.getBoardId(), userId, 
                                                                                request.getUserId()))
                                                                .thenReturn(card)))
                                .flatMap(card -> {
                                        Long previousAssignee = card.getAssignedTo();
                                        card.setAssignedTo(request.getUserId());
                                        return cardRepository.save(card)
                                                        .flatMap(savedCard -> {
                                                                if (savedCard.getAssignedTo() != null
                                                                                && !savedCard.getAssignedTo().equals(
                                                                                                previousAssignee)) {
                                                                        return boardListRepository.findById(
                                                                                        savedCard.getBoardListId())
                                                                                        .flatMap(list -> notificationService
                                                                                                        .createNotification(
                                                                                                                        savedCard.getAssignedTo(),
                                                                                                                        "You have been assigned to task: "
                                                                                                                                        + savedCard.getTitle(),
                                                                                                                        NotificationType.CARD_ASSIGNED,
                                                                                                                        savedCard.getId(),
                                                                                                                        savedCard.getWorkspaceId(),
                                                                                                                        list.getBoardId()));
                                                                }
                                                                return Mono.empty();
                                                        }).then();
                                });
        }

        public Mono<Void> removeAssignment(Long cardId, Long adminId, Long targetUserId) {
                return cardRepository.findById(cardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found")))
                                .flatMap(card -> boardListRepository.findById(card.getBoardListId())
                                                .flatMap(list -> {
                                                        // Permission model:
                                                        // - Workspace OWNER/ADMIN can remove anyone
                                                        // - Workspace MEMBER can remove self only
                                                        if (adminId.equals(targetUserId)) {
                                                                return boardService
                                                                                .checkBoardViewAccess(card.getWorkspaceId(),
                                                                                                list.getBoardId(),
                                                                                                adminId)
                                                                                .then(requireWorkspaceNonViewer(card.getWorkspaceId(), adminId))
                                                                                .thenReturn(card);
                                                        }
                                                        return verifyWorkspaceAdminOrOwner(card.getWorkspaceId(), adminId)
                                                                        .thenReturn(card);
                                                }))
                                .flatMap(card -> {
                                        if (card.getAssignedTo() != null && card.getAssignedTo().equals(targetUserId)) {
                                                card.setAssignedTo(null);
                                                return cardRepository.save(card)
                                                                .flatMap(savedCard -> activityLogService.logActivity(
                                                                                savedCard.getWorkspaceId(),
                                                                                savedCard.getId(), adminId,
                                                                                "CARD_ASSIGNMENT_REMOVED",
                                                                                "removed assignment from user")
                                                                                .then());
                                        }
                                        return Mono.empty();
                                });
        }

        public Mono<CardResponseDTO.CardChecklistResponseDTO> createChecklist(Long cardId, Long userId, String name) {
                return cardRepository.findById(cardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found")))
                                .flatMap(card -> boardListRepository.findById(card.getBoardListId())
                                                .flatMap(list -> boardService.checkBoardMember(card.getWorkspaceId(),
                                                                list.getBoardId(), userId)))
                                .then(cardChecklistRepository.save(CardChecklist.builder()
                                                .cardId(cardId)
                                                .name(name)
                                                .position(0)
                                                .build()))
                                .map(cl -> CardResponseDTO.CardChecklistResponseDTO.builder()
                                                .id(cl.getId())
                                                .name(cl.getName())
                                                .position(cl.getPosition())
                                                .items(List.of())
                                                .build());
        }

        public Mono<Void> deleteChecklist(Long checklistId, Long userId) {
                return cardChecklistRepository.findById(checklistId)
                                .flatMap(cl -> cardRepository.findById(cl.getCardId())
                                                .flatMap(card -> boardListRepository.findById(card.getBoardListId())
                                                                .flatMap(list -> boardService.checkBoardAdmin(
                                                                                card.getWorkspaceId(),
                                                                                list.getBoardId(), userId)))
                                                .then(cardChecklistItemRepository.deleteByChecklistId(checklistId))
                                                .then(cardChecklistRepository.delete(cl)));
        }

        public Mono<CardResponseDTO.CardChecklistItemResponseDTO> addChecklistItem(Long checklistId, Long userId,
                        String content) {
                return cardChecklistRepository.findById(checklistId)
                                .flatMap(cl -> cardRepository.findById(cl.getCardId())
                                                .flatMap(card -> boardListRepository.findById(card.getBoardListId())
                                                                .flatMap(list -> boardService.checkBoardMember(
                                                                                card.getWorkspaceId(),
                                                                                list.getBoardId(), userId))))
                                .then(cardChecklistItemRepository.save(CardChecklistItem.builder()
                                                .checklistId(checklistId)
                                                .content(content)
                                                .isChecked(false)
                                                .position(0)
                                                .build()))
                                .map(i -> CardResponseDTO.CardChecklistItemResponseDTO.builder()
                                                .id(i.getId())
                                                .content(i.getContent())
                                                .isChecked(i.getIsChecked())
                                                .position(i.getPosition())
                                                .build());
        }

        public Mono<CardResponseDTO.CardChecklistItemResponseDTO> updateChecklistItem(Long itemId, Long userId,
                        ChecklistItemUpdateRequestDTO request) {
                return cardChecklistItemRepository.findById(itemId)
                                .flatMap(item -> cardChecklistRepository.findById(item.getChecklistId())
                                                .flatMap(cl -> cardRepository.findById(cl.getCardId())
                                                                .flatMap(card -> checkCardParticipantPrivilege(card, userId)))
                                                .then(Mono.just(item)))
                                .flatMap(item -> {
                                        if (request.getContent() != null)
                                                item.setContent(request.getContent());
                                        if (request.getIsChecked() != null)
                                                item.setIsChecked(request.getIsChecked());
                                        return cardChecklistItemRepository.save(item);
                                })
                                .map(i -> CardResponseDTO.CardChecklistItemResponseDTO.builder()
                                                .id(i.getId())
                                                .content(i.getContent())
                                                .isChecked(i.getIsChecked())
                                                .position(i.getPosition())
                                                .build());
        }

        public Mono<Void> deleteChecklistItem(Long itemId, Long userId) {
                return cardChecklistItemRepository.findById(itemId)
                                .flatMap(item -> cardChecklistRepository.findById(item.getChecklistId())
                                                .flatMap(cl -> cardRepository.findById(cl.getCardId())
                                                                .flatMap(card -> boardListRepository
                                                                                .findById(card.getBoardListId())
                                                                                .flatMap(list -> boardService
                                                                                                .checkBoardMember(card
                                                                                                                .getWorkspaceId(),
                                                                                                                list.getBoardId(),
                                                                                                                userId))))
                                                .then(cardChecklistItemRepository.delete(item)));
        }

        private static Set<Long> extractMentionedUserIds(String content) {
                Set<Long> ids = new LinkedHashSet<>();
                if (content == null || content.isBlank()) {
                        return ids;
                }
                Matcher matcher = MENTION_PATTERN.matcher(content);
                while (matcher.find()) {
                        String rawId = matcher.group(2);
                        try {
                                ids.add(Long.parseLong(rawId));
                        } catch (NumberFormatException ignored) {
                                // ignore invalid mention payloads
                        }
                }
                return ids;
        }

        private Mono<Void> notifyMentionsIfAny(Card card, Long boardId, Long authorId, String authorName, String content) {
                Set<Long> mentioned = extractMentionedUserIds(content);
                mentioned.remove(authorId);
                if (mentioned.isEmpty()) {
                        return Mono.empty();
                }

                String message = String.format("%s mentioned you in a comment on \"%s\"",
                                (authorName == null || authorName.isBlank()) ? "Someone" : authorName,
                                card.getTitle());
                // Dashboard currently uses actionToken as a workspaceId in the Mentions panel.
                String actionToken = String.valueOf(card.getWorkspaceId());

                return Flux.fromIterable(mentioned)
                                .flatMap(mentionedUserId -> workspaceMemberRepository
                                                .findAllByWorkspaceIdAndUserId(card.getWorkspaceId(), mentionedUserId)
                                                .hasElements()
                                                .flatMap(isWsMember -> {
                                                        if (!Boolean.TRUE.equals(isWsMember)) {
                                                                return Mono.empty();
                                                        }
                                                        return notificationService.createNotification(
                                                                        mentionedUserId,
                                                                        message,
                                                                        NotificationType.MENTION,
                                                                        card.getId(),
                                                                        actionToken,
                                                                        card.getWorkspaceId(),
                                                                        boardId);
                                                }))
                                .then();
        }

        public Mono<CardResponseDTO.CardCommentResponseDTO> addComment(Long cardId, Long userId, String content) {
                return cardRepository.findById(cardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found")))
                                .flatMap(card -> boardListRepository.findById(card.getBoardListId())
                                                .flatMap(list -> checkCardParticipantPrivilege(card, userId)
                                                                .thenReturn(list.getBoardId()))
                                                .flatMap(boardId -> {
                                                        Mono<CardComment> savedCommentMono = cardCommentRepository.save(CardComment.builder()
                                                                        .cardId(cardId)
                                                                        .userId(userId)
                                                                        .content(content)
                                                                        .build());

                                                        Mono<String> authorNameMono = userRepository.findById(userId)
                                                                        .map(u -> u.getName())
                                                                        .defaultIfEmpty("Someone");

                                                        return Mono.zip(savedCommentMono, authorNameMono)
                                                                        .flatMap(tuple -> {
                                                                                CardComment comment = tuple.getT1();
                                                                                String authorName = tuple.getT2();

                                                                                Mono<Void> mentionNotifyMono = notifyMentionsIfAny(
                                                                                                card,
                                                                                                boardId,
                                                                                                userId,
                                                                                                authorName,
                                                                                                comment.getContent());

                                                                                Mono<CardResponseDTO.CardCommentResponseDTO> dtoMono = Mono.just(
                                                                                                CardResponseDTO.CardCommentResponseDTO.builder()
                                                                                                                .id(comment.getId())
                                                                                                                .userId(userId)
                                                                                                                .userName(authorName)
                                                                                                                .content(comment.getContent())
                                                                                                                .createdAt(comment.getCreatedAt())
                                                                                                                .build());

                                                                                return mentionNotifyMono.then(dtoMono);
                                                                        });
                                                }));
        }

        public Mono<CardResponseDTO.CardAttachmentResponseDTO> addAttachment(Long cardId, Long userId, String fileName,
                        String fileUrl, String fileType) {
                return cardRepository.findById(cardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found")))
                                .flatMap(card -> boardListRepository.findById(card.getBoardListId())
                                                .flatMap(list -> boardService
                                                                // Any workspace non-viewer can add attachments (not restricted to board members).
                                                                .checkBoardViewAccess(card.getWorkspaceId(), list.getBoardId(), userId)
                                                                .then(requireWorkspaceNonViewer(card.getWorkspaceId(), userId))
                                                                .then(validateAttachmentUrl(fileUrl))))
                                .then(cardAttachmentRepository.save(CardAttachment.builder()
                                                .cardId(cardId)
                                                .userId(userId)
                                                .fileName(fileName)
                                                .fileUrl(fileUrl)
                                                .fileType(fileType)
                                                .build()))
                                .map(a -> CardResponseDTO.CardAttachmentResponseDTO.builder()
                                                .id(a.getId())
                                                .userId(a.getUserId())
                                                .fileName(a.getFileName())
                                                .fileUrl(a.getFileUrl())
                                                .fileType(a.getFileType())
                                                .createdAt(a.getCreatedAt())
                                                .build());
        }

        public Mono<Void> deleteAttachment(Long cardId, Long actorId, Long attachmentId) {
                return cardRepository.findById(cardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found")))
                                .flatMap(card -> boardListRepository.findById(card.getBoardListId())
                                                .flatMap(list -> boardService
                                                                .checkBoardViewAccess(card.getWorkspaceId(),
                                                                                list.getBoardId(), actorId)
                                                                .then(requireWorkspaceNonViewer(card.getWorkspaceId(), actorId))
                                                                .then(cardAttachmentRepository.findByIdAndCardId(
                                                                                attachmentId, cardId))
                                                                .switchIfEmpty(Mono.error(new ResponseStatusException(
                                                                                HttpStatus.NOT_FOUND,
                                                                                "Attachment not found")))
                                                                .flatMap(att -> {
                                                                        if (att.getUserId() == null
                                                                                        || !actorId.equals(att.getUserId())) {
                                                                                return Mono.error(new ResponseStatusException(
                                                                                                HttpStatus.FORBIDDEN,
                                                                                                "Only the uploader can delete this attachment"));
                                                                        }
                                                                        return cardAttachmentRepository.deleteById(att.getId());
                                                                })));
        }

        public Mono<Void> addMemberToCard(Long cardId, Long adminId, Long targetUserId) {
                return cardRepository.findById(cardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found")))
                                .flatMap(card -> boardListRepository.findById(card.getBoardListId())
                                                .flatMap(list -> {
                                                        Mono<Void> permissionMono;
                                                        if (adminId.equals(targetUserId)) {
                                                                permissionMono = boardService
                                                                                .checkBoardViewAccess(card.getWorkspaceId(),
                                                                                                list.getBoardId(),
                                                                                                adminId)
                                                                                .then(requireWorkspaceNonViewer(card.getWorkspaceId(), adminId));
                                                        } else {
                                                                permissionMono = verifyWorkspaceAdminOrOwner(card.getWorkspaceId(), adminId);
                                                        }

                                                        return permissionMono
                                                                        .then(checkAssigneeInWorkspace(card.getWorkspaceId(), targetUserId))
                                                                        .then(cardMemberRepository.findAllByCardId(cardId)
                                                                                        .filter(m -> m.getUserId() != null && m.getUserId().equals(targetUserId))
                                                                                        .hasElements()
                                                                                        .flatMap(exists -> {
                                                                                                if (Boolean.TRUE.equals(exists)) {
                                                                                                        return Mono.error(new ResponseStatusException(
                                                                                                                        HttpStatus.CONFLICT,
                                                                                                                        "User is already a member of this card"));
                                                                                                }
                                                                                                return cardMemberRepository.save(CardMember.builder()
                                                                                                                .cardId(cardId)
                                                                                                                .userId(targetUserId)
                                                                                                                .build()).then();
                                                                                        }))
                                                                        .thenReturn(card);
                                                })
                                                .flatMap(savedMember -> boardListRepository
                                                                .findById(card.getBoardListId())
                                                                .flatMap(list -> notificationService.createNotification(
                                                                                targetUserId,
                                                                                "You have been added as a member to card: "
                                                                                                + card.getTitle(),
                                                                                NotificationType.CARD_ASSIGNED,
                                                                                cardId,
                                                                                card.getWorkspaceId(),
                                                                                list.getBoardId())))
                                                .then());
        }

        public Mono<Void> removeMemberFromCard(Long cardId, Long actorId, Long targetUserId) {
                return cardRepository.findById(cardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found")))
                                .flatMap(card -> boardListRepository.findById(card.getBoardListId())
                                                .flatMap(list -> {
                                                        Mono<Void> permissionMono;
                                                        if (actorId.equals(targetUserId)) {
                                                                permissionMono = boardService
                                                                                .checkBoardViewAccess(card.getWorkspaceId(),
                                                                                                list.getBoardId(),
                                                                                                actorId)
                                                                                .then(requireWorkspaceNonViewer(card.getWorkspaceId(), actorId));
                                                        } else {
                                                                permissionMono = verifyWorkspaceAdminOrOwner(card.getWorkspaceId(), actorId);
                                                        }

                                                        return permissionMono.thenReturn(card);
                                                }))
                                .flatMap(card -> cardMemberRepository.findAllByCardId(cardId)
                                                .filter(m -> m.getUserId() != null && m.getUserId().equals(targetUserId))
                                                .collectList()
                                                .flatMap(rows -> {
                                                        if (rows.isEmpty()) {
                                                                return Mono.error(new ResponseStatusException(
                                                                                HttpStatus.NOT_FOUND,
                                                                                "User is not a member of this card"));
                                                        }
                                                        return Flux.fromIterable(rows)
                                                                        .flatMap(cardMemberRepository::delete)
                                                                        .then();
                                                }));
        }

        public Mono<CardResponseDTO> moveCard(Long cardId, Long userId, CardMoveRequestDTO request) {
                return cardRepository.findById(cardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Card not found")))
                                .flatMap(card -> boardListRepository.findById(card.getBoardListId())
                                                .flatMap(list -> boardService
                                                                .checkBoardMember(card.getWorkspaceId(),
                                                                                list.getBoardId(), userId)
                                                                .then(checkBoardListInWorkspace(card.getWorkspaceId(),
                                                                                request.getBoardListId()))
                                                                .thenReturn(card)))
                                .flatMap(card -> {
                                        card.setBoardListId(request.getBoardListId());
                                        return cardRepository.save(card)
                                                        .flatMap(savedCard -> activityLogService
                                                                        .logActivity(savedCard.getWorkspaceId(),
                                                                                        savedCard.getId(), userId,
                                                                                        "CARD_MOVED",
                                                                                        "moved task to another list")
                                                                        .then(mapToResponseDTO(savedCard)));
                                });
        }

        private Mono<Void> checkAssigneeInWorkspace(Long workspaceId, Long userId) {
                if (userId == null)
                        return Mono.empty();
                return workspaceMemberRepository.findAllByWorkspaceIdAndUserId(workspaceId, userId)
                                .hasElements()
                                .flatMap(exists -> {
                                        if (!Boolean.TRUE.equals(exists)) {
                                                return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                                                "Assignee is not a member of this workspace"));
                                        }
                                        return Mono.empty();
                                })
                                .then();
        }

        private Mono<Void> checkBoardListInWorkspace(Long workspaceId, Long boardListId) {
                return boardListRepository.findById(boardListId)
                                .flatMap(list -> boardRepository.findById(list.getBoardId()))
                                .filter(board -> board.getWorkspaceId().equals(workspaceId))
                                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                                "Target list is not in this workspace")))
                                .then();
        }

        /**
         * Verifies if a user has permission to assign another user to a card.
         * Permission model:
         * - Workspace OWNER/ADMIN: can assign anyone in the workspace
         * - Workspace MEMBER: can only assign self
         * - Workspace VIEWER: cannot assign (enforced by checkBoardMember before this is called)
         */
        private Mono<Void> verifyUserCanAssign(Long workspaceId, Long boardId, Long userId, Long targetUserId) {
                if (targetUserId != null && userId.equals(targetUserId)) {
                        return Mono.empty();
                }
                
                // Only workspace OWNER/ADMIN can assign others.
                return workspaceMemberRepository.findAllByWorkspaceIdAndUserId(workspaceId, userId)
                                .collectList()
                                .flatMap(list -> {
                                        if (list.isEmpty()) {
                                                return Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                                "User is not a member of the workspace"));
                                        }
                                        // Pick the highest role if duplicates exist.
                                        WorkspaceRole best = list.get(0).getRole();
                                        for (var m : list) {
                                                WorkspaceRole r = m.getRole();
                                                if (r == WorkspaceRole.OWNER) {
                                                        best = r;
                                                        break;
                                                }
                                                if (r == WorkspaceRole.ADMIN) {
                                                        best = (best == WorkspaceRole.OWNER) ? best : WorkspaceRole.ADMIN;
                                                }
                                        }

                                        if (best == WorkspaceRole.OWNER || best == WorkspaceRole.ADMIN) {
                                                return Mono.empty();
                                        }
                                        return Mono.error(new ResponseStatusException(
                                                        HttpStatus.FORBIDDEN,
                                                        "Members can only assign themselves to cards"));
                                })
                                .then();
        }

        private Mono<Void> verifyWorkspaceAdminOrOwner(Long workspaceId, Long userId) {
                return workspaceMemberRepository.findAllByWorkspaceIdAndUserId(workspaceId, userId)
                                .collectList()
                                .flatMap(list -> {
                                        if (list.isEmpty()) {
                                                return Mono.error(new ResponseStatusException(
                                                                HttpStatus.FORBIDDEN,
                                                                "User is not a member of the workspace"));
                                        }
                                        boolean isOwner = list.stream().anyMatch(m -> m.getRole() == WorkspaceRole.OWNER);
                                        boolean isAdmin = list.stream().anyMatch(m -> m.getRole() == WorkspaceRole.ADMIN);
                                        if (isOwner || isAdmin) {
                                                return Mono.empty();
                                        }
                                        return Mono.error(new ResponseStatusException(
                                                        HttpStatus.FORBIDDEN,
                                                        "Only workspace owners/admins can perform this action"));
                                })
                                .then();
        }

        public Mono<CardResponseDTO> mapToResponseDTO(Card card) {
                return Mono.zip(
                                cardLabelRepository.findAllByCardId(card.getId()).map(CardLabel::getLabelName)
                                                .collectList(),
                                cardMemberRepository.findAllByCardId(card.getId()).collectList(),
                                cardChecklistRepository.findAllByCardIdOrderByPosition(card.getId())
                                                .flatMap(cl -> cardChecklistItemRepository
                                                                .findAllByChecklistIdOrderByPosition(cl.getId())
                                                                .collectList()
                                                                .map(items -> CardResponseDTO.CardChecklistResponseDTO
                                                                                .builder()
                                                                                .id(cl.getId())
                                                                                .name(cl.getName())
                                                                                .position(cl.getPosition())
                                                                                .items(items.stream()
                                                                                                .map(i -> CardResponseDTO.CardChecklistItemResponseDTO
                                                                                                                .builder()
                                                                                                                .id(i.getId())
                                                                                                                .content(i.getContent())
                                                                                                                .isChecked(i.getIsChecked())
                                                                                                                .position(i.getPosition())
                                                                                                                .build())
                                                                                                .collect(Collectors
                                                                                                                .toList()))
                                                                                .build()))
                                                .collectList(),
                                cardCommentRepository.findAllByCardIdOrderByCreatedAtDesc(card.getId())
                                                .flatMap(c -> userRepository.findById(c.getUserId())
                                                                .map(u -> CardResponseDTO.CardCommentResponseDTO
                                                                                .builder()
                                                                                .id(c.getId())
                                                                                .userId(c.getUserId())
                                                                                .userName(u.getName())
                                                                                .content(c.getContent())
                                                                                .createdAt(c.getCreatedAt())
                                                                                .build()))
                                                .collectList(),
                                cardAttachmentRepository.findAllByCardId(card.getId()).collectList())
                                .map(tuple -> CardResponseDTO.builder()
                                                .id(card.getId())
                                                .title(card.getTitle())
                                                .description(card.getDescription())
                                                .workspaceId(card.getWorkspaceId())
                                                .assignedTo(card.getAssignedTo())
                                                .priority(card.getPriority())
                                                .dueDate(card.getDueDate())
                                                .parentId(card.getParentId())
                                                .boardListId(card.getBoardListId())
                                                .createdBy(card.getCreatedBy())
                                                .createdAt(card.getCreatedAt())
                                                .updatedAt(card.getUpdatedAt())
                                                .labels(tuple.getT1())
                                                .members(tuple.getT2().stream()
                                                                .map(m -> CardResponseDTO.CardMemberResponseDTO
                                                                                .builder()
                                                                                .userId(m.getUserId())
                                                                                .joinedAt(m.getCreatedAt())
                                                                                .build())
                                                                .collect(Collectors.toList()))
                                                .checklists(tuple.getT3())
                                                .comments(tuple.getT4())
                                                .attachments(tuple.getT5().stream()
                                                                .map(a -> CardResponseDTO.CardAttachmentResponseDTO
                                                                                .builder()
                                                                                .id(a.getId())
                                                                                .userId(a.getUserId())
                                                                                .fileName(a.getFileName())
                                                                                .fileUrl(a.getFileUrl())
                                                                                .fileType(a.getFileType())
                                                                                .createdAt(a.getCreatedAt())
                                                                                .build())
                                                                .collect(Collectors.toList()))
                                                .build());
        }

        private Mono<Void> saveLabels(Long cardId, List<String> labels) {
                if (labels == null)
                        return Mono.empty();
                return cardLabelRepository.deleteByCardId(cardId)
                                .thenMany(Flux.fromIterable(labels))
                                .flatMap(label -> cardLabelRepository.save(CardLabel.builder()
                                                .cardId(cardId)
                                                .labelName(label)
                                                .build()))
                                .then();
        }
}
