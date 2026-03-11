/**
 * Project: Smart Task Management
 * Layer: Repository (Data Access Layer)
 * Component: Card
 * Description: Handles data persistence and database interactions.
 */
package com.smarttask.card.repository;

import com.smarttask.card.entity.Card;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;

import java.time.LocalDateTime;

@Repository
public interface CardRepository extends ReactiveCrudRepository<Card, Long> {
    Flux<Card> findByWorkspaceId(Long workspaceId);

    Flux<Card> findByParentId(Long parentId);

    Flux<Card> findByAssignedTo(Long userId);

    Flux<Card> findByBoardListId(Long boardListId);

    Flux<Card> findByDueDateBetweenAndAssignedToIsNotNull(LocalDateTime start, LocalDateTime end);
}
