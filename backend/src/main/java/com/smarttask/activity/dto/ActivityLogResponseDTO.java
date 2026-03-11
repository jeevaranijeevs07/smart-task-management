package com.smarttask.activity.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActivityLogResponseDTO {
    private Long id;
    private Long workspaceId;
    private String workspaceName;
    private Long cardId;
    private String cardTitle;
    private Long userId;
    private String userName;
    private String userAvatar;
    private String action;
    private String description;
    private LocalDateTime createdAt;
}
