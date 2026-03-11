/**
 * Project: Smart Task Management
 * Layer: Repository (Data Access Layer)
 * Component: Card
 * Description: Handles data persistence and database interactions.
 */
package com.smarttask.card.repository;

import com.smarttask.card.entity.CardChecklistItem;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface CardChecklistItemRepository extends ReactiveCrudRepository<CardChecklistItem, Long> {
    Flux<CardChecklistItem> findAllByChecklistIdOrderByPosition(Long checklistId);

    reactor.core.publisher.Mono<Void> deleteByChecklistId(Long checklistId);
}

