/**
 * Project: Smart Task Management
 * Layer: Repository (Data Access Layer)
 * Component: Card
 * Description: Handles data persistence and database interactions.
 */
package com.smarttask.card.repository;

import com.smarttask.card.entity.CardComment;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface CardCommentRepository extends ReactiveCrudRepository<CardComment, Long> {
    Flux<CardComment> findAllByCardIdOrderByCreatedAtDesc(Long cardId);

    Mono<Void> deleteByCardId(Long cardId);
}

