/**
 * Project: Smart Task Management
 * Layer: Controller (API Layer)
 * Component: User
 * Description: Handles HTTP requests for the component.
 */
package com.smarttask.user.controller;

import com.smarttask.user.dto.UserResponseDTO;
import com.smarttask.user.service.UserSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserSearchController {

    private final UserSearchService userService;

    @GetMapping("/search")
    public Flux<UserResponseDTO> searchUsers(@RequestParam String query) {
        return userService.searchUsers(query);
    }
}

