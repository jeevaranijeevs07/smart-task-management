/**
 * Project: Smart Task Management
 * Layer: Repository (Data Access Layer)
 * Component: User
 * Description: Handles data persistence and database interactions.
 */
package com.smarttask.workspace.repository;

import com.smarttask.workspace.entity.WorkspaceInvitation;
import com.smarttask.common.entities.enums.InvitationStatus;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Repository
public interface WorkspaceInvitationRepository extends ReactiveCrudRepository<WorkspaceInvitation, Long> {
    Mono<WorkspaceInvitation> findByToken(String token);

    Flux<WorkspaceInvitation> findAllByEmail(String email);
    Flux<WorkspaceInvitation> findAllByEmailAndStatus(String email, InvitationStatus status);
}

