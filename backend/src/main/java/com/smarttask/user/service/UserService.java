/**
 * Project: Smart Task Management
 * Component: User Service
 * Description: Implements business logic for User operations such as registration, authentication, and password resets.
 */
package com.smarttask.user.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import com.smarttask.user.dto.RegisterRequest;
import com.smarttask.user.dto.RegisterResponse;
import com.smarttask.user.dto.LoginRequest;
import com.smarttask.user.dto.LoginResponse;
import com.smarttask.user.dto.UserResponseDTO;
import com.smarttask.user.dto.ForgotPasswordRequest;
import com.smarttask.user.dto.ResetPasswordRequest;
import com.smarttask.user.dto.UpdateProfileRequest;

import com.smarttask.user.entity.User;
import com.smarttask.user.entity.PasswordResetToken;
import com.smarttask.common.entities.enums.SystemRole;
import com.smarttask.common.exceptions.InvalidCredentialsException;
import com.smarttask.common.exceptions.UserAlreadyExistsException;
import com.smarttask.user.repository.UserRepository;
import com.smarttask.user.repository.PasswordResetTokenRepository;
import com.smarttask.workspace.service.WorkspaceInvitationService;
import com.smarttask.common.security.JwtService;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

        private final UserRepository userRepository;
        private final PasswordEncoder passwordEncoder;
        private final JwtService jwtService;
        private final WorkspaceInvitationService invitationService;
        private final PasswordResetTokenRepository tokenRepository;

        /**
         * Registers a new user after checking if the email is already in use.
         */
        public Mono<RegisterResponse> registerUser(RegisterRequest request) {
                String email = request.getEmail().toLowerCase().trim();

                return userRepository.existsByEmail(email)
                                .flatMap(exists -> {
                                        if (Boolean.TRUE.equals(exists)) {
                                                return Mono.error(
                                                                new UserAlreadyExistsException("Email already in use"));
                                        }

                                        User user = User.builder()
                                                        .name(request.getName())
                                                        .email(email)
                                                        .password(passwordEncoder.encode(request.getPassword()))
                                                        .systemRole(SystemRole.USER)
                                                        .build();

                                        return userRepository.save(user)
                                                        .flatMap(savedUser -> invitationService
                                                                        .handleAutoAcceptAfterSignup(savedUser)
                                                                        .onErrorResume(error -> Mono.empty())
                                                                        .thenReturn(savedUser))
                                                        .map(savedUser -> RegisterResponse.builder()
                                                                        .message("User registered successfully")
                                                                        .build());
                                });
        }

        /**
         * Authenticates a user and returns a JWT token if credentials are valid.
         */
        public Mono<LoginResponse> login(LoginRequest request) {
                String email = request.getEmail().toLowerCase().trim();
                return userRepository.findByEmail(email)
                                .filter(user -> passwordEncoder.matches(request.getPassword(), user.getPassword()))
                                .map(user -> {
                                        String token = jwtService.generateToken(user.getId().toString(),
                                                        user.getSystemRole().name());
                                        return LoginResponse.builder()
                                                        .token(token)
                                                        .user(UserResponseDTO.builder()
                                                                        .id(user.getId())
                                                                        .name(user.getName())
                                                                        .email(user.getEmail())
                                                                        .role(user.getSystemRole())
                                                                        .avatarUrl(user.getAvatarUrl())
                                                                        .build())
                                                        .build();
                                })
                                .switchIfEmpty(Mono
                                                .error(new InvalidCredentialsException("Invalid email or password")));
        }

        /**
         * Retrieves data for the currently authenticated user by their ID.
         */
        public Mono<UserResponseDTO> getCurrentUser(String userId) {
                return userRepository.findById(Long.parseLong(userId))
                                .map(user -> UserResponseDTO.builder()
                                                .id(user.getId())
                                                .name(user.getName())
                                                .email(user.getEmail())
                                                .role(user.getSystemRole())
                                                .avatarUrl(user.getAvatarUrl())
                                                .build());
        }

        /**
         * Retrieves user details by their numeric ID and returns a DTO.
         */
        public Mono<UserResponseDTO> getUserById(Long id) {
                return userRepository.findById(id)
                                .map(user -> UserResponseDTO.builder()
                                                .id(user.getId())
                                                .name(user.getName())
                                                .email(user.getEmail())
                                                .role(user.getSystemRole())
                                                .avatarUrl(user.getAvatarUrl())
                                                .build());
        }

        /**
         * Updates a user's profile information (name and avatar).
         */
        public Mono<UserResponseDTO> updateProfile(Long userId, UpdateProfileRequest request) {
                String normalizedName = normalizeName(request.getName());
                String normalizedAvatarUrl = normalizeAvatarUrl(request.getAvatarUrl());

                return userRepository.findById(userId)
                                .switchIfEmpty(Mono.error(new RuntimeException("User not found")))
                                .flatMap(user -> {
                                        user.setName(normalizedName);
                                        user.setAvatarUrl(normalizedAvatarUrl);
                                        return userRepository.save(user);
                                })
                                .map(updatedUser -> UserResponseDTO.builder()
                                                .id(updatedUser.getId())
                                                .name(updatedUser.getName())
                                                .email(updatedUser.getEmail())
                                                .role(updatedUser.getSystemRole())
                                                .avatarUrl(updatedUser.getAvatarUrl())
                                                .build());
        }

        /**
         * Initiates the forgot password process by generating a reset token.
         */
        public Mono<Void> processForgotPassword(ForgotPasswordRequest request) {
                String email = request.getEmail().toLowerCase().trim();
                return userRepository.findByEmail(email)
                                .flatMap(user -> {
                                        String token = UUID.randomUUID().toString();
                                        PasswordResetToken resetToken = PasswordResetToken.builder()
                                                        .userId(user.getId())
                                                        .token(token)
                                                        .expiryDate(LocalDateTime.now().plusMinutes(15))
                                                        .createdAt(LocalDateTime.now())
                                                        .build();

                                        return tokenRepository.deleteByUserId(user.getId())
                                                        .then(tokenRepository.save(resetToken))
                                                        .doOnSuccess(saved -> {
                                                                String resetLink = "http://localhost:5173/reset-password?token="
                                                                                + token;
                                                                System.out.println(
                                                                                "========================================");
                                                                System.out.println("PASSWORD RESET REQUEST for: "
                                                                                + user.getEmail());
                                                                System.out.println("Reset Link: " + resetLink);
                                                                System.out.println(
                                                                                "========================================");
                                                        });
                                })
                                .then();
        }

        /**
         * Resets a user's password using a valid reset token.
         */
        public Mono<Void> resetPassword(ResetPasswordRequest request) {
                return tokenRepository.findByToken(request.getToken())
                                .switchIfEmpty(Mono.error(new RuntimeException("Invalid reset token")))
                                .flatMap(token -> {
                                        if (token.getExpiryDate().isBefore(LocalDateTime.now())) {
                                                return Mono.error(new RuntimeException("Reset token expired"));
                                        }

                                        return userRepository.findById(token.getUserId())
                                                        .flatMap(user -> {
                                                                user.setPassword(passwordEncoder
                                                                                .encode(request.getNewPassword()));
                                                                return userRepository.save(user)
                                                                                .then(tokenRepository.deleteById(
                                                                                                token.getId()));
                                                        });
                                })
                                .then();
        }

        /**
         * Deletes a user by their ID.
         */
        public Mono<Void> deleteCurrentUser(Long userId) {
                return userRepository.findById(userId)
                                .switchIfEmpty(Mono.error(new IllegalArgumentException("User not found")))
                                .flatMap(user -> userRepository.deleteById(user.getId()));
        }

        /**
         * Normalizes and validates the user name.
         */
        private String normalizeName(String name) {
                if (name == null) {
                        throw new IllegalArgumentException("Name is required");
                }

                String normalized = name.trim().replaceAll("\\s+", " ");
                if (normalized.length() < 2 || normalized.length() > 50) {
                        throw new IllegalArgumentException("Name must be between 2 and 50 characters");
                }

                return normalized;
        }

        /**
         * Normalizes and validates the avatar URL.
         */
        private String normalizeAvatarUrl(String avatarUrl) {
                if (avatarUrl == null) {
                        return null;
                }

                String normalized = avatarUrl.trim();
                return normalized.isEmpty() ? null : normalized;
        }

}
