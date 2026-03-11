package com.smarttask.activity.repository;

import com.smarttask.activity.entity.ActivityLog;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;

@Repository
public interface ActivityLogRepository extends ReactiveCrudRepository<ActivityLog, Long> {
    Flux<ActivityLog> findAllByWorkspaceIdOrderByCreatedAtDesc(Long workspaceId);

    Flux<ActivityLog> findAllByCardIdOrderByCreatedAtDesc(Long cardId);

    Flux<ActivityLog> findByWorkspaceIdInOrderByCreatedAtDesc(java.util.Collection<Long> workspaceIds);
}
