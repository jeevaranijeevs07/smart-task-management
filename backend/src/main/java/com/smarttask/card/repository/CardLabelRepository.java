/**
 * Project: Smart Task Management
 * Layer: Repository (Data Access Layer)
 * Component: Card
 * Description: Handles data persistence and database interactions.
 */
package com.smarttask.card.repository;

import com.smarttask.card.entity.CardLabel;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Repository
public interface CardLabelRepository extends ReactiveCrudRepository<CardLabel, Long> {
    Flux<CardLabel> findAllByCardId(Long cardId);

    Mono<Void> deleteByCardId(Long cardId);
}

