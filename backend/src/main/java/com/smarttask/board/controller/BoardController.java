/**
 * Project: Smart Task Management
 * Component: Board Controller
 * Description: Manages board lifecycle, including creation, retrieval, updates, and member management.
 */
package com.smarttask.board.controller;

import com.smarttask.board.dto.BoardMemberRequestDTO;
import com.smarttask.board.dto.BoardMemberResponseDTO;
import com.smarttask.board.dto.BoardRequestDTO;
import com.smarttask.board.dto.BoardResponseDTO;
import com.smarttask.board.dto.BoardDetailsResponseDTO;
import com.smarttask.board.service.BoardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class BoardController {

    private final BoardService boardService;

    /**
     * Creates a new board within a workspace.
     */
    @PostMapping("/workspaces/{workspaceId}/boards")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<BoardResponseDTO> createBoard(
            @PathVariable Long workspaceId,
            @RequestBody BoardRequestDTO request,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return boardService.createBoard(workspaceId, userId, request);
    }

    /**
     * Retrieves all boards within a workspace for the authenticated user.
     */
    @GetMapping("/workspaces/{workspaceId}/boards")
    public Flux<BoardResponseDTO> getWorkspaceBoards(
            @PathVariable Long workspaceId,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return boardService.getWorkspaceBoards(workspaceId, userId);
    }

    /**
     * Retrieves detailed information about a specific board, including its members.
     */
    @GetMapping("/boards/{id}")
    public Mono<BoardDetailsResponseDTO> getBoardById(
            @PathVariable Long id,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return boardService.getBoardDetailsById(id, userId);
    }

    /**
     * Updates a board's basic details (name, description, visibility).
     */
    @PutMapping("/boards/{id}")
    public Mono<BoardResponseDTO> updateBoard(
            @PathVariable Long id,
            @RequestBody BoardRequestDTO request,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return boardService.updateBoard(id, userId, request);
    }

    /**
     * Deletes a board and all its associated data.
     */
    @DeleteMapping("/boards/{id}")
    public Mono<java.util.Map<String, String>> deleteBoard(
            @PathVariable Long id,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return boardService.deleteBoard(id, userId)
                .then(Mono.just(java.util.Map.of("message", "Board deleted successfully")));
    }

    /**
     * Adds a member to a board with a specified role.
     */
    @PostMapping("/boards/{id}/members")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<BoardMemberResponseDTO> addMember(
            @PathVariable Long id,
            @RequestBody BoardMemberRequestDTO request,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return boardService.addBoardMember(id, userId, request);
    }

    /**
     * Removes a member from a board.
     */
    @DeleteMapping("/boards/{id}/members/{userId}")
    public Mono<java.util.Map<String, String>> removeMember(
            @PathVariable Long id,
            @PathVariable Long userId,
            Authentication authentication) {
        Long adminId = Long.parseLong(authentication.getName());
        return boardService.removeBoardMember(id, adminId, userId)
                .then(Mono.just(java.util.Map.of("message", "Board member removed successfully")));
    }
}
