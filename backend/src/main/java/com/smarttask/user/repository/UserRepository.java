/**
 * Project: Smart Task Management
 * Layer: Repository (Data Access Layer)
 * Component: User
 * Description: Handles data persistence and database interactions.
 */
package com.smarttask.user.repository;

import com.smarttask.user.entity.User;
import reactor.core.publisher.Mono;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;

public interface UserRepository extends ReactiveCrudRepository<User, Long> {

    Mono<User> findByEmail(String email);
    Mono<User> findByEmailIgnoreCase(String email);

    Mono<Boolean> existsByEmail(String email);

    reactor.core.publisher.Flux<User> findByNameContainingIgnoreCaseOrEmailContainingIgnoreCase(String name,
            String email);
}

