/**
 * Project: Smart Task Management
 * Component: User Controller
 * Description: Manages User-related API endpoints including registration, authentication, and profile management.
 */
package com.smarttask.user.controller;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Mono;
import org.springframework.web.bind.annotation.*;
import com.smarttask.user.service.UserService;
import com.smarttask.user.dto.RegisterRequest;
import com.smarttask.user.dto.RegisterResponse;
import com.smarttask.user.dto.LoginRequest;
import com.smarttask.user.dto.LoginResponse;
import com.smarttask.user.dto.UserResponseDTO;
import com.smarttask.user.dto.ForgotPasswordRequest;
import com.smarttask.user.dto.ResetPasswordRequest;
import com.smarttask.user.dto.UpdateProfileRequest;
import org.springframework.security.core.Authentication;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService; // Inject service

    /**
     * Registers a new user.
     */
    @PostMapping("/register")
    public Mono<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
        return userService.registerUser(request);
    }

    /**
     * Authenticates a user and returns a login response.
     */
    @PostMapping("/login")
    public Mono<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return userService.login(request);
    }

    /**
     * Initiates the forgot password process for a user.
     */
    @PostMapping("/forgot-password")
    public Mono<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return userService.processForgotPassword(request);
    }

    /**
     * Resets a user's password using a valid token.
     */
    @PostMapping("/reset-password")
    public Mono<Void> resetPassword(@RequestBody ResetPasswordRequest request) {
        return userService.resetPassword(request);
    }

    /**
     * Test endpoint for verifying protected route access.
     */
    @GetMapping("/test")
    public Mono<String> test() {
        return Mono.just("Protected endpoint accessed!");
    }

    /**
     * Retrieves the profile of the currently authenticated user.
     */
    @GetMapping("/me")
    public Mono<UserResponseDTO> getCurrentUser(Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return userService.getUserById(userId);
    }

    /**
     * Updates the profile of the currently authenticated user.
     */
    @PutMapping("/me")
    public Mono<UserResponseDTO> updateCurrentUser(
            Authentication authentication,
            @Valid @RequestBody UpdateProfileRequest request) {
        Long userId = Long.parseLong(authentication.getName());
        return userService.updateProfile(userId, request);
    }

    /**
     * Deletes the currently authenticated user's account.
     */
    @DeleteMapping("/me")
    public Mono<Void> deleteCurrentUser(Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        return userService.deleteCurrentUser(userId);
    }

    /**
     * Administrative test endpoint.
     */
    @GetMapping("/admin")
    public Mono<String> adminTest() {
        return Mono.just("Admin endpoint accessed!");
    }
}
