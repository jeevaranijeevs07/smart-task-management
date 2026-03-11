/**
 * Project: Smart Task Management
 * Layer: Entity (Database Model)
 * Component: User
 * Description: Represents the database schema for the component.
 */
package com.smarttask.workspace.entity;

import com.smarttask.common.entities.enums.InvitationStatus;
import com.smarttask.common.entities.enums.WorkspaceRole;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDateTime;

@Table("workspace_invitations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkspaceInvitation {

    @Id
    private Long id;

    @Column("workspace_id")
    private Long workspaceId;

    private String email;

    private WorkspaceRole role;

    private String token;

    private InvitationStatus status;

    @Column("invited_by")
    private Long invitedBy;

    @Column("created_at")
    private LocalDateTime createdAt;

    @Column("updated_at")
    private LocalDateTime updatedAt;
}

