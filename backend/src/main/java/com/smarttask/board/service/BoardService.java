/**
 * Project: Smart Task Management
 * Component: Board Service
 * Description: Implements business logic for board management, including CRUD operations, membership, and access control.
 */
package com.smarttask.board.service;

import com.smarttask.board.dto.BoardMemberRequestDTO;
import com.smarttask.board.dto.BoardMemberResponseDTO;
import com.smarttask.board.dto.BoardRequestDTO;
import com.smarttask.board.dto.BoardResponseDTO;
import com.smarttask.board.entity.Board;
import com.smarttask.board.entity.BoardList;
import com.smarttask.board.entity.BoardMember;
import com.smarttask.board.repository.BoardListRepository;
import com.smarttask.board.repository.BoardMemberRepository;
import com.smarttask.board.repository.BoardRepository;
import com.smarttask.common.entities.enums.BoardRole;
import com.smarttask.common.entities.enums.WorkspaceRole;
import com.smarttask.board.dto.BoardDetailsResponseDTO;
import com.smarttask.board.dto.BoardListDetailsDTO;
import com.smarttask.board.dto.BoardMemberDetailsDTO;
import com.smarttask.card.dto.CardResponseDTO;
import com.smarttask.card.repository.CardRepository;
import com.smarttask.user.repository.UserRepository;
import com.smarttask.workspace.repository.WorkspaceMemberRepository;
import lombok.RequiredArgsConstructor;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
@RequiredArgsConstructor
public class BoardService {

        private final BoardRepository boardRepository;
        private final WorkspaceMemberRepository workspaceMemberRepository;
        private final BoardMemberRepository boardMemberRepository;
        private final BoardListRepository boardListRepository;
        private final UserRepository userRepository;
        private final CardRepository cardRepository;

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

        private Mono<com.smarttask.workspace.entity.WorkspaceMember> findEffectiveWorkspaceMember(Long workspaceId, Long userId) {
                // Defensive: some DBs may contain duplicate workspace_members rows; pick the highest role.
                return workspaceMemberRepository.findAllByWorkspaceIdAndUserId(workspaceId, userId)
                                .collectList()
                                .flatMap(list -> {
                                        if (list.isEmpty()) {
                                                return Mono.empty();
                                        }
                                        com.smarttask.workspace.entity.WorkspaceMember best = list.get(0);
                                        for (com.smarttask.workspace.entity.WorkspaceMember m : list) {
                                                if (wsRoleRank(m.getRole()) > wsRoleRank(best.getRole())) {
                                                        best = m;
                                                }
                                        }
                                        return Mono.just(best);
                                });
        }

        /**
         * Creates a new board within a workspace and initializes it with default lists
         * (To Do, In Progress, Verification, Done).
         */
        public Mono<BoardResponseDTO> createBoard(Long workspaceId, Long userId, BoardRequestDTO request) {
                return checkWorkspaceAdmin(workspaceId, userId)
                                .then(boardRepository.save(Board.builder()
                                                .name(request.getName())
                                                .description(request.getDescription())
                                                .workspaceId(workspaceId)
                                                .background(request.getBackground())
                                                .build()))
                                .flatMap(savedBoard -> {
                                        BoardList todo = BoardList
                                                        .builder()
                                                        .name("To Do").boardId(savedBoard.getId()).position(0).build();
                                        BoardList inProgress = BoardList
                                                        .builder()
                                                        .name("In Progress").boardId(savedBoard.getId()).position(1)
                                                        .build();
                                        BoardList verification = BoardList
                                                        .builder()
                                                        .name("Verification").boardId(savedBoard.getId()).position(2)
                                                        .build();
                                        BoardList done = BoardList
                                                        .builder()
                                                        .name("Done").boardId(savedBoard.getId()).position(3).build();

                                        return boardListRepository
                                                        .saveAll(java.util.List.of(todo, inProgress, verification,
                                                                        done))
                                                        .then(Mono.just(mapToResponseDTO(savedBoard)));
                                });
        }

        /**
         * Retrieves all boards for a specific workspace that the user has access to.
         */
        public Flux<BoardResponseDTO> getWorkspaceBoards(Long workspaceId, Long userId) {
                return checkUserInWorkspace(workspaceId, userId)
                                .thenMany(boardRepository.findByWorkspaceId(workspaceId))
                                .map(this::mapToResponseDTO);
        }

        /**
         * Retrieves basic information for a board by its ID.
         */
        public Mono<BoardResponseDTO> getBoardById(Long boardId, Long userId) {
                return boardRepository.findById(boardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Board not found")))
                                .flatMap(board -> checkBoardViewAccess(board.getWorkspaceId(), boardId, userId)
                                                .thenReturn(mapToResponseDTO(board)));
        }

        /**
         * Retrieves comprehensive board details, including members, lists, and cards.
         */
        public Mono<BoardDetailsResponseDTO> getBoardDetailsById(Long boardId, Long userId) {
                return boardRepository.findById(boardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Board not found")))
                                .flatMap(board -> checkBoardViewAccess(board.getWorkspaceId(), boardId, userId)
                                                .thenReturn(board))
                                .flatMap(board -> {
                                        Mono<List<BoardMemberDetailsDTO>> membersMono = boardMemberRepository
                                                        .findByBoardId(boardId)
                                                        .flatMap(member -> userRepository.findById(member.getUserId())
                                                                        .map(user -> BoardMemberDetailsDTO.builder()
                                                                                        .id(member.getId())
                                                                                        .boardId(member.getBoardId())
                                                                                        .userId(member.getUserId())
                                                                                        .name(user.getName())
                                                                                        .email(user.getEmail())
                                                                                        .role(member.getRole())
                                                                                        .createdAt(member
                                                                                                        .getCreatedAt())
                                                                                        .updatedAt(member
                                                                                                        .getUpdatedAt())
                                                                                        .build())
                                                                        .defaultIfEmpty(BoardMemberDetailsDTO.builder()
                                                                                        .id(member.getId())
                                                                                        .boardId(member.getBoardId())
                                                                                        .userId(member.getUserId())
                                                                                        .role(member.getRole())
                                                                                        .createdAt(member
                                                                                                        .getCreatedAt())
                                                                                        .updatedAt(member
                                                                                                        .getUpdatedAt())
                                                                                        .build()))
                                                        .collectList();

                                        Mono<List<BoardListDetailsDTO>> listsMono = boardListRepository
                                                        .findByBoardIdOrderByPosition(boardId)
                                                        .flatMap(list -> cardRepository.findByBoardListId(list.getId())
                                                                        .map(card -> CardResponseDTO.builder()
                                                                                        .id(card.getId())
                                                                                        .title(card.getTitle())
                                                                                        .description(card
                                                                                                        .getDescription())
                                                                                        .workspaceId(card
                                                                                                        .getWorkspaceId())
                                                                                        .assignedTo(card.getAssignedTo())
                                                                                        .priority(card.getPriority())
                                                                                        .dueDate(card.getDueDate())
                                                                                        .parentId(card.getParentId())
                                                                                        .boardListId(card
                                                                                                        .getBoardListId())
                                                                                        .createdBy(card.getCreatedBy())
                                                                                        .createdAt(card.getCreatedAt())
                                                                                        .updatedAt(card.getUpdatedAt())
                                                                                        .build())
                                                                        .collectList()
                                                                        .map(cards -> BoardListDetailsDTO.builder()
                                                                                        .id(list.getId())
                                                                                        .name(list.getName())
                                                                                        .boardId(list.getBoardId())
                                                                                        .position(list.getPosition())
                                                                                        .createdAt(list.getCreatedAt())
                                                                                        .updatedAt(list.getUpdatedAt())
                                                                                        .cards(cards)
                                                                                        .build()))
                                                        .collectList();

                                        return Mono.zip(membersMono, listsMono)
                                                        .map(tuple -> BoardDetailsResponseDTO.builder()
                                                                        .id(board.getId())
                                                                        .name(board.getName())
                                                                        .description(board.getDescription())
                                                                        .workspaceId(board.getWorkspaceId())
                                                                        .createdAt(board.getCreatedAt())
                                                                        .updatedAt(board.getUpdatedAt())
                                                                        .background(board.getBackground())
                                                                        .members(tuple.getT1())
                                                                        .lists(tuple.getT2())
                                                                        .build());
                                });
        }

        /**
         * Updates a board's metadata. Requires administrative privileges.
         */
        public Mono<BoardResponseDTO> updateBoard(Long boardId, Long userId, BoardRequestDTO request) {
                return boardRepository.findById(boardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Board not found")))
                                .flatMap(board -> checkBoardAdmin(board.getWorkspaceId(), boardId, userId)
                                                .then(Mono.defer(() -> {
                                                        board.setName(request.getName());
                                                        board.setDescription(request.getDescription());
                                                        board.setBackground(request.getBackground());
                                                        return boardRepository.save(board).map(this::mapToResponseDTO);
                                                })));
        }

        /**
         * Permanently deletes a board.
         */
        public Mono<Void> deleteBoard(Long boardId, Long userId) {
                return boardRepository.findById(boardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Board not found")))
                                .flatMap(board -> checkBoardAdmin(board.getWorkspaceId(), boardId, userId)
                                                .then(boardRepository.delete(board)));
        }

        /**
         * Adds a user to a board with a specific role.
         */
        public Mono<BoardMemberResponseDTO> addBoardMember(Long boardId, Long userId, BoardMemberRequestDTO request) {
                return boardRepository.findById(boardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Board not found")))
                                .flatMap(board -> checkBoardAdmin(board.getWorkspaceId(), boardId, userId)
                                                .then(checkUserInWorkspace(board.getWorkspaceId(), request.getUserId()))
                                                .then(boardMemberRepository
                                                                .findByBoardIdAndUserId(boardId, request.getUserId())
                                                                .flatMap(existing -> Mono.<BoardMember>error(
                                                                                new ResponseStatusException(
                                                                                                HttpStatus.BAD_REQUEST,
                                                                                                "User is already a member of this board")))
                                                                .switchIfEmpty(Mono.defer(() -> {
                                                                        BoardMember member = BoardMember.builder()
                                                                                        .boardId(boardId)
                                                                                        .userId(request.getUserId())
                                                                                        .role(request.getRole())
                                                                                        .build();
                                                                        return boardMemberRepository.save(member);
                                                                }))))
                                .map(this::mapToMemberResponseDTO);
        }

        /**
         * Retrieves the list of all members assigned to a board.
         */
        public Flux<BoardMemberResponseDTO> getBoardMembers(Long boardId, Long userId) {
                return boardRepository.findById(boardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Board not found")))
                                .flatMapMany(board -> checkBoardViewAccess(board.getWorkspaceId(), boardId, userId)
                                                .thenMany(boardMemberRepository.findByBoardId(boardId)))
                                .map(this::mapToMemberResponseDTO);
        }

        /**
         * Removes a member from a board. Handles special cases like Workspace Owner and
         * last Board Admin.
         */
        public Mono<Void> removeBoardMember(Long boardId, Long adminId, Long targetUserId) {
                return boardRepository.findById(boardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Board not found")))
                                .flatMap(board -> checkBoardAdmin(board.getWorkspaceId(), boardId, adminId)
                                                .then(findEffectiveWorkspaceMember(board.getWorkspaceId(), targetUserId)
                                                                .switchIfEmpty(Mono.error(new ResponseStatusException(
                                                                                HttpStatus.NOT_FOUND,
                                                                                "Target user is not a member of the workspace"))))
                                                .flatMap(targetWsMember -> {
                                                        if (targetWsMember.getRole() == WorkspaceRole.OWNER) {
                                                                return Mono.error(new ResponseStatusException(
                                                                                HttpStatus.FORBIDDEN,
                                                                                "Cannot remove the Workspace Owner from a board"));
                                                        }
                                                        return boardMemberRepository
                                                                        .findByBoardIdAndUserId(boardId, targetUserId)
                                                                        .switchIfEmpty(Mono.error(
                                                                                        new ResponseStatusException(
                                                                                                        HttpStatus.NOT_FOUND,
                                                                                                        "User is not a board member")))
                                                                        .flatMap(targetBoardMember -> {
                                                                                if (adminId.equals(targetUserId)
                                                                                                && targetBoardMember
                                                                                                                .getRole() == BoardRole.ADMIN) {
                                                                                        return boardMemberRepository
                                                                                                        .findByBoardId(boardId)
                                                                                                        .filter(m -> m.getRole() == BoardRole.ADMIN)
                                                                                                        .count()
                                                                                                        .flatMap(count -> {
                                                                                                                if (count <= 1) {
                                                                                                                        return Mono.error(
                                                                                                                                        new ResponseStatusException(
                                                                                                                                                        HttpStatus.FORBIDDEN,
                                                                                                                                                        "Cannot remove yourself as you are the last board admin"));
                                                                                                                }
                                                                                                                return boardMemberRepository
                                                                                                                                .delete(targetBoardMember);
                                                                                                        });
                                                                                }
                                                                                return boardMemberRepository.delete(
                                                                                                targetBoardMember);
                                                                        });
                                                }));
        }

        /**
         * Helper method to verify if a user has administrative rights in a workspace
         * (Owner or Admin).
         */
        private Mono<Void> checkWorkspaceAdmin(Long workspaceId, Long userId) {
                return findEffectiveWorkspaceMember(workspaceId, userId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                                "User is not a member of the workspace")))
                                .flatMap(member -> {
                                        if (member.getRole() != WorkspaceRole.OWNER
                                                        && member.getRole() != WorkspaceRole.ADMIN) {
                                                return Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                                "Only Workspace Admins or Owners can perform this action"));
                                        }
                                        return Mono.empty();
                                });
        }

        /**
         * Verifies if a user has the right to modify cards on a board (not a Viewer at
         * Workspace or Board level).
         */
        public Mono<Void> checkCardMutationPrivilege(Long workspaceId, Long boardId, Long userId) {
                return findEffectiveWorkspaceMember(workspaceId, userId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                                "User is not a member of the workspace")))
                                .flatMap(wsMember -> {
                                        if (wsMember.getRole() == WorkspaceRole.VIEWER) {
                                                return Mono.error(new ResponseStatusException(
                                                                HttpStatus.FORBIDDEN,
                                                                "Workspace Viewers cannot modify cards"));
                                        }
                                        if (wsMember.getRole() == WorkspaceRole.OWNER
                                                        || wsMember.getRole() == WorkspaceRole.ADMIN) {
                                                return Mono.empty();
                                        }
                                        return boardMemberRepository.findByBoardIdAndUserId(boardId, userId)
                                                        .flatMap(boardMember -> {
                                                                if (boardMember.getRole() == BoardRole.MEMBER
                                                                                || boardMember.getRole() == BoardRole.ADMIN) {
                                                                        return Mono.empty();
                                                                }
                                                                return Mono.error(new ResponseStatusException(
                                                                                HttpStatus.FORBIDDEN,
                                                                                "Board Viewers cannot modify cards"));
                                                        })
                                                        .switchIfEmpty(Mono.error(new ResponseStatusException(
                                                                        HttpStatus.FORBIDDEN,
                                                                        "User is not a member of this board")));
                                }).then();
        }

        /**
         * Verifies user presence in a workspace.
         */
        private Mono<Void> checkUserInWorkspace(Long workspaceId, Long userId) {
                return findEffectiveWorkspaceMember(workspaceId, userId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                                "User is not a member of the workspace")))
                                .then();
        }

        /**
         * Maps a Board entity to a BoardResponseDTO.
         */
        private BoardResponseDTO mapToResponseDTO(Board board) {
                return BoardResponseDTO.builder()
                                .id(board.getId())
                                .name(board.getName())
                                .description(board.getDescription())
                                .workspaceId(board.getWorkspaceId())
                                .createdAt(board.getCreatedAt())
                                .updatedAt(board.getUpdatedAt())
                                .background(board.getBackground())
                                .build();
        }

        /**
         * Maps a BoardMember entity to a BoardMemberResponseDTO.
         */
        private BoardMemberResponseDTO mapToMemberResponseDTO(BoardMember member) {
                return BoardMemberResponseDTO.builder()
                                .id(member.getId())
                                .boardId(member.getBoardId())
                                .userId(member.getUserId())
                                .role(member.getRole())
                                .createdAt(member.getCreatedAt())
                                .updatedAt(member.getUpdatedAt())
                                .build();
        }

        /**
         * Verifies if a user has administrative rights on a specific board (or is a
         * Workspace Admin/Owner).
         */
        public Mono<Void> checkBoardAdmin(Long workspaceId, Long boardId, Long userId) {
                return findEffectiveWorkspaceMember(workspaceId, userId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                                "User is not a member of the workspace")))
                                .flatMap(wsMember -> {
                                        if (wsMember.getRole() == WorkspaceRole.OWNER
                                                        || wsMember.getRole() == WorkspaceRole.ADMIN) {
                                                return Mono.empty();
                                        }
                                        return boardMemberRepository.findByBoardIdAndUserId(boardId, userId)
                                                        .flatMap(boardMember -> {
                                                                if (boardMember.getRole() == BoardRole.ADMIN) {
                                                                        return Mono.empty();
                                                                }
                                                                return Mono.error(new ResponseStatusException(
                                                                                HttpStatus.FORBIDDEN,
                                                                                "Only Board Admins can perform this action"));
                                                        })
                                                        .switchIfEmpty(Mono.error(new ResponseStatusException(
                                                                        HttpStatus.FORBIDDEN,
                                                                        "User does not have admin access to this board")));
                                }).then();
        }

        /**
         * Verifies if a user is a member or admin of a board (and not a Workspace
         * Viewer).
         */
        public Mono<Void> checkBoardMember(Long workspaceId, Long boardId, Long userId) {
                return findEffectiveWorkspaceMember(workspaceId, userId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                                "User is not a member of the workspace")))
                                .flatMap(wsMember -> {
                                        if (wsMember.getRole() == WorkspaceRole.OWNER
                                                        || wsMember.getRole() == WorkspaceRole.ADMIN) {
                                                return Mono.empty();
                                        }
                                        if (wsMember.getRole() == WorkspaceRole.VIEWER) {
                                                return Mono.error(new ResponseStatusException(
                                                                HttpStatus.FORBIDDEN,
                                                                "Workspace Viewers cannot perform this action"));
                                        }
                                        return boardMemberRepository.findByBoardIdAndUserId(boardId, userId)
                                                        .flatMap(boardMember -> {
                                                                if (boardMember.getRole() == BoardRole.MEMBER
                                                                                || boardMember.getRole() == BoardRole.ADMIN) {
                                                                        return Mono.empty();
                                                                }
                                                                return Mono.error(new ResponseStatusException(
                                                                                HttpStatus.FORBIDDEN,
                                                                                "User is only a viewer on this board"));
                                                        })
                                                        .switchIfEmpty(Mono.error(new ResponseStatusException(
                                                                        HttpStatus.FORBIDDEN,
                                                                        "User is not a member of this board")));
                                }).then();
        }

        /**
         * Verifies if a user has read access to a board.
         */
        public Mono<Void> checkBoardViewAccess(Long workspaceId, Long boardId, Long userId) {
                return findEffectiveWorkspaceMember(workspaceId, userId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                                "User is not a member of the workspace")))
                                .then();
        }
}
