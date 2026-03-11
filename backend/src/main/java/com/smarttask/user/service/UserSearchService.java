/**
 * Project: Smart Task Management
 * Layer: Service (Business Logic Layer)
 * Component: User
 * Description: Contains business logic and service implementations.
 */
package com.smarttask.user.service;

import com.smarttask.user.dto.UserResponseDTO;
import com.smarttask.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

@Service
@RequiredArgsConstructor
public class UserSearchService {

    private final UserRepository userRepository;

    public Flux<UserResponseDTO> searchUsers(String query) {
        if (query == null || query.trim().isEmpty()) {
            return Flux.empty();
        }
        return userRepository.findByNameContainingIgnoreCaseOrEmailContainingIgnoreCase(query, query)
                .map(user -> UserResponseDTO.builder()
                        .id(user.getId())
                        .name(user.getName())
                        .email(user.getEmail())
                        .avatarUrl(user.getAvatarUrl())
                        .build());
    }
}

