/**
 * Project: Smart Task Management
 * Layer: Entity (Database Model)
 * Component: User
 * Description: Represents the database schema for the component.
 */
package com.smarttask.user.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;
import org.springframework.data.relational.core.mapping.Column;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonProperty;

import com.smarttask.common.entities.enums.SystemRole;

@Table("users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    private Long id;

    private String name;

    private String email;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    @Column("system_role")
    private SystemRole systemRole;

    @Column("avatar_url")
    private String avatarUrl;
}

