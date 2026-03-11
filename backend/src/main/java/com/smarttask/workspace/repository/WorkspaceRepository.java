/**
 * Project: Smart Task Management
 * Layer: Repository (Data Access Layer)
 * Component: User
 * Description: Handles data persistence and database interactions.
 */
package com.smarttask.workspace.repository;

import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import com.smarttask.workspace.entity.Workspace;

public interface WorkspaceRepository extends ReactiveCrudRepository<Workspace, Long> {

}

