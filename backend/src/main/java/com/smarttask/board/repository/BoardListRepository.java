/**
 * Project: Smart Task Management
 * Layer: Repository (Data Access Layer)
 * Component: Board
 * Description: Handles data persistence and database interactions.
 */
package com.smarttask.board.repository;

import com.smarttask.board.entity.BoardList;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;

@Repository
public interface BoardListRepository extends ReactiveCrudRepository<BoardList, Long> {
    Flux<BoardList> findByBoardIdOrderByPosition(Long boardId);
}

