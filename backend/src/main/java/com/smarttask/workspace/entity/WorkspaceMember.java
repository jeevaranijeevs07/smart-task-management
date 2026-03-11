/**
 * Project: Smart Task Management
 * Layer: Entity (Database Model)
 * Component: User
 * Description: Represents the database schema for the component.
 */
package com.smarttask.workspace.entity;

import com.smarttask.common.entities.enums.WorkspaceRole;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;
import org.springframework.data.relational.core.mapping.Column;
import lombok.*;

@Table("workspace_members")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkspaceMember {

    @Id
    private Long id;

    @Column("workspace_id")
    private Long workspaceId;

    @Column("user_id")
    private Long userId;

    private WorkspaceRole role;
}
