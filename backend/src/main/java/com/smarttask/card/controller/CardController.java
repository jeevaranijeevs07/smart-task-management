/**
 * Project: Smart Task Management
 * Component: Card Controller
 * Description: Handles API endpoints for card operations, including CRUD, movement, assignment, and rich features like checklists and comments.
 */
package com.smarttask.card.controller;

import com.smarttask.card.dto.*;
import com.smarttask.card.service.CardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CardController {

    private final CardService cardService;

    // Workspace specific routes

    /**
     * Creates a new card within a specific workspace.
     */
    @PostMapping("/workspaces/{workspaceId}/cards")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<CardResponseDTO> createCard(
            @PathVariable Long workspaceId,
            @RequestBody CreateCardRequestDTO request,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return cardService.createCard(workspaceId, userId, request);
    }

    /**
     * Retrieves all cards belonging to a specific workspace.
     */
    @GetMapping("/workspaces/{workspaceId}/cards")
    public Flux<CardResponseDTO> getWorkspaceCards(
            @PathVariable Long workspaceId,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return cardService.getWorkspaceCards(workspaceId, userId);
    }

    // Flat Card routes

    /**
     * Retrieves detailed information for a specific card.
     */
    @GetMapping("/cards/{cardId}")
    public Mono<CardResponseDTO> getCard(
            @PathVariable Long cardId,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return cardService.getCard(cardId, userId);
    }

    /**
     * Updates the properties of an existing card.
     */
    @PutMapping("/cards/{cardId}")
    public Mono<CardResponseDTO> updateCard(
            @PathVariable Long cardId,
            @RequestBody UpdateCardRequestDTO request,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return cardService.updateCard(cardId, userId, request);
    }

    /**
     * Permanently deletes a card.
     */
    @DeleteMapping("/cards/{cardId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> deleteCard(
            @PathVariable Long cardId,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return cardService.deleteCard(cardId, userId);
    }

    /**
     * Moves a card to a different board list.
     */
    @PutMapping("/cards/{cardId}/move")
    public Mono<CardResponseDTO> moveCard(
            @PathVariable Long cardId,
            @Valid @RequestBody CardMoveRequestDTO request,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return cardService.moveCard(cardId, userId, request);
    }

    /**
     * Assigns a user to a card.
     */
    @PostMapping("/cards/{cardId}/assign")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<Void> assignUser(
            @PathVariable Long cardId,
            @Valid @RequestBody CardAssignRequestDTO request,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return cardService.assignUser(cardId, userId, request);
    }

    /**
     * Removes a user's assignment from a card.
     */
    @DeleteMapping("/cards/{cardId}/assign/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> removeAssignment(
            @PathVariable Long cardId,
            @PathVariable("userId") Long targetUserId,
            Authentication authentication) {
        Long adminId = Long.parseLong(authentication.getName());
        return cardService.removeAssignment(cardId, adminId, targetUserId);
    }

    // Rich Features Endpoints

    /**
     * Creates a new checklist for a card.
     */
    @PostMapping("/cards/{cardId}/checklists")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<CardResponseDTO.CardChecklistResponseDTO> createChecklist(
            @PathVariable Long cardId,
            @RequestBody CardChecklistRequestDTO request,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return cardService.createChecklist(cardId, userId, request.getName());
    }

    /**
     * Deletes a checklist and its items.
     */
    @DeleteMapping("/checklists/{checklistId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> deleteChecklist(
            @PathVariable Long checklistId,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return cardService.deleteChecklist(checklistId, userId);
    }

    /**
     * Adds a new item to a checklist.
     */
    @PostMapping("/checklists/{checklistId}/items")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<CardResponseDTO.CardChecklistItemResponseDTO> addChecklistItem(
            @PathVariable Long checklistId,
            @RequestBody CardChecklistItemRequestDTO request,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return cardService.addChecklistItem(checklistId, userId, request.getContent());
    }

    /**
     * Updates the content or completion status of a checklist item.
     */
    @PutMapping("/checklist-items/{itemId}")
    public Mono<CardResponseDTO.CardChecklistItemResponseDTO> updateChecklistItem(
            @PathVariable Long itemId,
            @RequestBody ChecklistItemUpdateRequestDTO request,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return cardService.updateChecklistItem(itemId, userId, request);
    }

    /**
     * Removes an item from a checklist.
     */
    @DeleteMapping("/checklist-items/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> deleteChecklistItem(
            @PathVariable Long itemId,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return cardService.deleteChecklistItem(itemId, userId);
    }

    /**
     * Adds a user comment to a card.
     */
    @PostMapping("/cards/{cardId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<CardResponseDTO.CardCommentResponseDTO> addComment(
            @PathVariable Long cardId,
            @RequestBody CardCommentRequestDTO request,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return cardService.addComment(cardId, userId, request.getContent());
    }

    /**
     * Attaches a file to a card.
     */
    @PostMapping("/cards/{cardId}/attachments")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<CardResponseDTO.CardAttachmentResponseDTO> addAttachment(
            @PathVariable Long cardId,
            @RequestBody CardAttachmentRequestDTO request,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return cardService.addAttachment(cardId, userId, request.getFileName(), request.getFileUrl(),
                request.getFileType());
    }

    /**
     * Deletes an attachment from a card (only the uploader can delete).
     */
    @DeleteMapping("/cards/{cardId}/attachments/{attachmentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> deleteAttachment(
            @PathVariable Long cardId,
            @PathVariable Long attachmentId,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return cardService.deleteAttachment(cardId, userId, attachmentId);
    }

    /**
     * Adds a member to a card for collaborative tracking.
     */
    @PostMapping("/cards/{cardId}/members/{userId}")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<Void> addMemberToCard(
            @PathVariable Long cardId,
            @PathVariable("userId") Long targetUserId,
            Authentication authentication) {
        Long adminId = Long.parseLong(authentication.getName());
        return cardService.addMemberToCard(cardId, adminId, targetUserId);
    }

    /**
     * Removes a member from a card (collaborative tracking).
     */
    @DeleteMapping("/cards/{cardId}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> removeMemberFromCard(
            @PathVariable Long cardId,
            @PathVariable("userId") Long targetUserId,
            Authentication authentication) {
        Long actorId = Long.parseLong(authentication.getName());
        return cardService.removeMemberFromCard(cardId, actorId, targetUserId);
    }
}
