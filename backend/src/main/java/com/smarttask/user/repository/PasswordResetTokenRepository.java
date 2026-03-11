/**
 * Project: Smart Task Management
 * Layer: Repository (Data Access Layer)
 * Component: User
 * Description: Handles data persistence and database interactions.
 */
package com.smarttask.user.repository;

import com.smarttask.user.entity.PasswordResetToken;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Mono;

public interface PasswordResetTokenRepository extends ReactiveCrudRepository<PasswordResetToken, Long> {
    Mono<PasswordResetToken> findByToken(String token);

    Mono<Void> deleteByUserId(Long userId);
}

