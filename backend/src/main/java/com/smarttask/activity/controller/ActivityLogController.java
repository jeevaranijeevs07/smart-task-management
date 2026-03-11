package com.smarttask.activity.controller;

import com.smarttask.activity.dto.ActivityLogResponseDTO;
import com.smarttask.activity.service.ActivityLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api/activities")
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class ActivityLogController {

    private final ActivityLogService activityLogService;

    @GetMapping("/recent")
    public Flux<ActivityLogResponseDTO> getRecentActivities() {
        return org.springframework.security.core.context.ReactiveSecurityContextHolder.getContext()
                .map(org.springframework.security.core.context.SecurityContext::getAuthentication)
                .flatMapMany(auth -> {
                    String userIdStr = (String) auth.getPrincipal();
                    log.info("Fetching recent activities for user: {}", userIdStr);
                    return activityLogService.getRecentActivitiesForUser(Long.parseLong(userIdStr));
                })
                .doOnError(error -> log.error("Error in getRecentActivities: {}", error.getMessage(), error));
    }
}
