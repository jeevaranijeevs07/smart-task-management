/**
 * Project: Smart Task Management
 * Layer: Repository (Data Access Layer)
 * Component: User
 * Description: Handles data persistence and database interactions.
 */
package com.smarttask.workspace.repository;

import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import com.smarttask.workspace.entity.WorkspaceMember;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface WorkspaceMemberRepository extends ReactiveCrudRepository<WorkspaceMember, Long> {
    Flux<WorkspaceMember> findByWorkspaceId(Long workspaceId);

    Flux<WorkspaceMember> findByUserId(Long userId);

    Mono<Boolean> existsByWorkspaceIdAndUserId(Long workspaceId, Long userId);

    // Defensive: historical DBs may contain duplicates; callers can clean them up.
    Flux<WorkspaceMember> findAllByWorkspaceIdAndUserId(Long workspaceId, Long userId);

    Mono<WorkspaceMember> findByWorkspaceIdAndUserId(Long workspaceId, Long userId);
}

