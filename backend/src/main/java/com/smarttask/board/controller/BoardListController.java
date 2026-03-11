/**
 * Project: Smart Task Management
 * Component: Board List Controller
 * Description: Manages the lifecycle of lists within a board, including creation, retrieval, renaming, and reordering.
 */
package com.smarttask.board.controller;

import com.smarttask.board.dto.BoardListRequestDTO;
import com.smarttask.board.dto.BoardListResponseDTO;
import com.smarttask.board.dto.BoardListRenameRequestDTO;
import com.smarttask.board.dto.BoardListReorderRequestDTO;
import com.smarttask.board.service.BoardListService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/boards/{boardId}/lists")
@RequiredArgsConstructor
public class BoardListController {

    private final BoardListService boardListService;

    /**
     * Creates a new list on a specific board.
     */
    @PostMapping
    public Mono<BoardListResponseDTO> createList(
            @PathVariable Long boardId,
            @RequestBody BoardListRequestDTO request,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return boardListService.createList(boardId, userId, request);
    }

    /**
     * Retrieves all lists for a specific board.
     */
    @GetMapping
    public Flux<BoardListResponseDTO> getBoardLists(
            @PathVariable Long boardId,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return boardListService.getBoardLists(boardId, userId);
    }

    /**
     * Renames an existing board list.
     */
    @PutMapping("/{id}")
    public Mono<BoardListResponseDTO> updateList(
            @PathVariable Long boardId,
            @PathVariable Long id,
            @Valid @RequestBody BoardListRenameRequestDTO request,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return boardListService.updateList(boardId, id, userId, request);
    }

    /**
     * Deletes a board list.
     */
    @DeleteMapping("/{id}")
    public Mono<java.util.Map<String, String>> deleteList(
            @PathVariable Long boardId,
            @PathVariable Long id,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return boardListService.deleteList(boardId, id, userId)
                .then(Mono.just(java.util.Map.of("message", "Board list deleted successfully")));
    }

    /**
     * Reorders the lists on a board based on provided positions.
     */
    @PutMapping("/reorder")
    public Flux<BoardListResponseDTO> reorderLists(
            @PathVariable Long boardId,
            @Valid @RequestBody BoardListReorderRequestDTO request,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return boardListService.reorderLists(boardId, userId, request);
    }
}
