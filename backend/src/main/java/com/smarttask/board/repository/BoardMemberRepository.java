/**
 * Project: Smart Task Management
 * Layer: Repository (Data Access Layer)
 * Component: Board
 * Description: Handles data persistence and database interactions.
 */
package com.smarttask.board.repository;

import com.smarttask.board.entity.BoardMember;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Repository
public interface BoardMemberRepository extends ReactiveCrudRepository<BoardMember, Long> {
    Flux<BoardMember> findByBoardId(Long boardId);

    Mono<BoardMember> findByBoardIdAndUserId(Long boardId, Long userId);

    Flux<BoardMember> findByUserId(Long userId);
}

