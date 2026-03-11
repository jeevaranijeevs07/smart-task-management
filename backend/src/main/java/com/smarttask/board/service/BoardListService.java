/**
 * Project: Smart Task Management
 * Component: Board List Service
 * Description: Manages the business logic for board lists, including creation, retrieval, and reordering.
 */
package com.smarttask.board.service;

import com.smarttask.board.dto.BoardListRequestDTO;
import com.smarttask.board.dto.BoardListResponseDTO;
import com.smarttask.board.dto.BoardListRenameRequestDTO;
import com.smarttask.board.dto.BoardListReorderRequestDTO;
import com.smarttask.board.entity.BoardList;
import com.smarttask.board.repository.BoardListRepository;
import com.smarttask.board.repository.BoardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
@RequiredArgsConstructor
public class BoardListService {

        private final BoardListRepository boardListRepository;
        private final BoardRepository boardRepository;
        private final BoardService boardService;

        /**
         * Creates a new list on a specific board. Requires Board Admin privileges.
         */
        public Mono<BoardListResponseDTO> createList(Long boardId, Long userId, BoardListRequestDTO request) {
                return boardRepository.findById(boardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Board not found")))
                                .flatMap(board -> boardService.checkBoardAdmin(board.getWorkspaceId(), boardId, userId)
                                                .then(Mono.defer(() -> {
                                                        BoardList list = BoardList.builder()
                                                                        .name(request.getName())
                                                                        .boardId(boardId)
                                                                        .position(request.getPosition() != null
                                                                                        ? request.getPosition()
                                                                                        : 0)
                                                                        .build();
                                                        return boardListRepository.save(list)
                                                                        .map(this::mapToResponseDTO);
                                                })));
        }

        /**
         * Retrieves all lists for a given board in their defined order.
         */
        public Flux<BoardListResponseDTO> getBoardLists(Long boardId, Long userId) {
                return boardRepository.findById(boardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Board not found")))
                                .flatMapMany(board -> boardService
                                                .checkBoardViewAccess(board.getWorkspaceId(), boardId, userId)
                                                .thenMany(boardListRepository.findByBoardIdOrderByPosition(boardId)))
                                .map(this::mapToResponseDTO);
        }

        /**
         * Updates (renames) an existing list. Requires Board Member privileges.
         */
        public Mono<BoardListResponseDTO> updateList(Long boardId, Long listId, Long userId,
                        BoardListRenameRequestDTO request) {
                return boardRepository.findById(boardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Board not found")))
                                .flatMap(board -> boardService.checkBoardMember(board.getWorkspaceId(), boardId, userId)
                                                .then(boardListRepository.findById(listId))
                                                .switchIfEmpty(Mono.error(new ResponseStatusException(
                                                                HttpStatus.NOT_FOUND, "List not found")))
                                                .flatMap(list -> {
                                                        if (!list.getBoardId().equals(boardId)) {
                                                                return Mono.error(new ResponseStatusException(
                                                                                HttpStatus.BAD_REQUEST,
                                                                                "List does not belong to this board"));
                                                        }
                                                        list.setName(request.getName());
                                                        return boardListRepository.save(list)
                                                                        .map(this::mapToResponseDTO);
                                                }));
        }

        /**
         * Removes a list from a board. Requires Board Admin privileges.
         */
        public Mono<Void> deleteList(Long boardId, Long listId, Long userId) {
                return boardRepository.findById(boardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Board not found")))
                                .flatMap(board -> boardService.checkBoardAdmin(board.getWorkspaceId(), boardId, userId)
                                                .then(boardListRepository.findById(listId))
                                                .switchIfEmpty(Mono.error(new ResponseStatusException(
                                                                HttpStatus.NOT_FOUND, "List not found")))
                                                .flatMap(list -> {
                                                        if (!list.getBoardId().equals(boardId)) {
                                                                return Mono.error(new ResponseStatusException(
                                                                                HttpStatus.BAD_REQUEST,
                                                                                "List does not belong to this board"));
                                                        }
                                                        return boardListRepository.delete(list);
                                                }));
        }

        /**
         * Updates the positions of multiple lists on a board simultaneously.
         */
        public Flux<BoardListResponseDTO> reorderLists(Long boardId, Long userId, BoardListReorderRequestDTO request) {
                return boardRepository.findById(boardId)
                                .switchIfEmpty(Mono.error(
                                                new ResponseStatusException(HttpStatus.NOT_FOUND, "Board not found")))
                                .flatMapMany(board -> boardService
                                                .checkBoardMember(board.getWorkspaceId(), boardId, userId)
                                                .thenMany(boardListRepository.findByBoardIdOrderByPosition(boardId))
                                                .collectList()
                                                .flatMapMany(existingLists -> {
                                                        java.util.List<Long> requestedIds = request.getListIds();

                                                        // 1. Check size matches
                                                        if (existingLists.size() != requestedIds.size()) {
                                                                return Flux.error(new ResponseStatusException(
                                                                                HttpStatus.BAD_REQUEST,
                                                                                "Request size does not match existing list count"));
                                                        }

                                                        // 2. Check for duplicates in request
                                                        long uniqueCount = requestedIds.stream().distinct().count();
                                                        if (uniqueCount != requestedIds.size()) {
                                                                return Flux.error(new ResponseStatusException(
                                                                                HttpStatus.BAD_REQUEST,
                                                                                "Duplicate list IDs provided in request"));
                                                        }

                                                        // 3. Ensure all provided IDs actually exist in the DB for this
                                                        // board
                                                        java.util.Set<Long> existingListIds = existingLists.stream()
                                                                        .map(BoardList::getId)
                                                                        .collect(java.util.stream.Collectors.toSet());
                                                        for (Long id : requestedIds) {
                                                                if (!existingListIds.contains(id)) {
                                                                        return Flux.error(new ResponseStatusException(
                                                                                        HttpStatus.BAD_REQUEST,
                                                                                        "Invalid list ID provided or does not belong to board: "
                                                                                                        + id));
                                                                }
                                                        }

                                                        // 4. Create a map for quick lookup
                                                        java.util.Map<Long, BoardList> listMap = existingLists.stream()
                                                                        .collect(java.util.stream.Collectors.toMap(
                                                                                        BoardList::getId,
                                                                                        list -> list));

                                                        // 5. Reassign positions sequentially 1..N based on requested
                                                        // order
                                                        java.util.List<BoardList> listsToUpdate = new java.util.ArrayList<>();
                                                        for (int i = 0; i < requestedIds.size(); i++) {
                                                                BoardList list = listMap.get(requestedIds.get(i));
                                                                list.setPosition(i + 1); // 1-based sequential position
                                                                listsToUpdate.add(list);
                                                        }

                                                        return boardListRepository.saveAll(listsToUpdate)
                                                                        .map(this::mapToResponseDTO);
                                                }));
        }

        /**
         * Maps a BoardList entity to a BoardListResponseDTO.
         */
        private BoardListResponseDTO mapToResponseDTO(BoardList list) {
                return BoardListResponseDTO.builder()
                                .id(list.getId())
                                .name(list.getName())
                                .boardId(list.getBoardId())
                                .position(list.getPosition())
                                .createdAt(list.getCreatedAt())
                                .updatedAt(list.getUpdatedAt())
                                .build();
        }
}
