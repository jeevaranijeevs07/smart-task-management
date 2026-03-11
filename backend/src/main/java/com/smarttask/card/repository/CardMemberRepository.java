/**
 * Project: Smart Task Management
 * Layer: Repository (Data Access Layer)
 * Component: Card
 * Description: Handles data persistence and database interactions.
 */
package com.smarttask.card.repository;

import com.smarttask.card.entity.CardMember;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface CardMemberRepository extends ReactiveCrudRepository<CardMember, Long> {
    Flux<CardMember> findAllByCardId(Long cardId);

    Mono<Void> deleteByCardId(Long cardId);
}

