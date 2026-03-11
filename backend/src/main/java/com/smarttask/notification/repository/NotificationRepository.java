/**
 * Project: Smart Task Management
 * Layer: Repository (Data Access Layer)
 * Component: User
 * Description: Handles data persistence and database interactions.
 */
package com.smarttask.notification.repository;

import com.smarttask.notification.entity.Notification;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;

@Repository
public interface NotificationRepository extends ReactiveCrudRepository<Notification, Long> {
    Flux<Notification> findAllByUserIdOrderByCreatedAtDesc(Long userId);

    Flux<Notification> findAllByUserIdAndReadFalse(Long userId);
}


