/**
 * Project: Smart Task Management
 * Layer: DTO (Data Transfer Object)
 * Component: Card
 * Description: Data transfer object for API request/response.
 */
package com.smarttask.card.dto;

import com.smarttask.card.entity.enums.CardPriority;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CardResponseDTO {
    private Long id;
    private String title;
    private String description;
    private Long workspaceId;
    private Long assignedTo;
    private CardPriority priority;
    private LocalDateTime dueDate;
    private Long parentId;
    private Long boardListId;
    private Long createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<String> labels;

    // Rich features
    private List<CardMemberResponseDTO> members;
    private List<CardChecklistResponseDTO> checklists;
    private List<CardCommentResponseDTO> comments;
    private List<CardAttachmentResponseDTO> attachments;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CardMemberResponseDTO {
        private Long userId;
        private LocalDateTime joinedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CardChecklistResponseDTO {
        private Long id;
        private String name;
        private Integer position;
        private List<CardChecklistItemResponseDTO> items;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CardChecklistItemResponseDTO {
        private Long id;
        private String content;
        private Boolean isChecked;
        private Integer position;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CardCommentResponseDTO {
        private Long id;
        private Long userId;
        private String userName;
        private String userAvatar;
        private String content;
        private LocalDateTime createdAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CardAttachmentResponseDTO {
        private Long id;
        private Long userId;
        private String fileName;
        private String fileUrl;
        private String fileType;
        private LocalDateTime createdAt;
    }
}
