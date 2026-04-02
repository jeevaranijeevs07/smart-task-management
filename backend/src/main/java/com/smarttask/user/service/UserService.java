/**
 * Project: Smart Task Management
 * Component: User Service
 * Description: Implements business logic for User operations such as registration, authentication, and password resets.
 */
package com.smarttask.user.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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
import com.smarttask.notification.service.EmailService;
import com.smarttask.workspace.service.WorkspaceInvitationService;
import com.smarttask.common.security.JwtService;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

        private final UserRepository userRepository;
        private final PasswordEncoder passwordEncoder;
        private final JwtService jwtService;
        private final WorkspaceInvitationService invitationService;
        private final PasswordResetTokenRepository tokenRepository;
        private final EmailService emailService;

        @Value("${app.frontend-base-url:http://localhost:5173}")
        private String frontendBaseUrl;

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
                log.info("[LOGIN_ATTEMPT] email={}", email);

                return userRepository.findByEmail(email)
                                .doOnNext(user -> log.debug("[LOGIN_DB] User found in database email={}", user.getEmail()))
                                .filter(user -> {
                                        boolean matches = passwordEncoder.matches(request.getPassword(), user.getPassword());
                                        if (!matches) {
                                                log.warn("[LOGIN_FAILURE] Password mismatch for email={}", email);
                                        }
                                        return matches;
                                })
                                .map(user -> {
                                        log.info("[LOGIN_SUCCESS] userId={} email={}", user.getId(), email);
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
                                .switchIfEmpty(Mono.defer(() -> {
                                        log.warn("[LOGIN_FAILURE] User not found or criteria not met for email={}", email);
                                        return Mono.error(new InvalidCredentialsException("Invalid email or password"));
                                }));
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
                log.info("[PASSWORD_RESET][REQUEST] Forgot password requested for email={}", maskEmail(email));
                return userRepository.findByEmail(email)
                                .switchIfEmpty(Mono.defer(() -> {
                                        log.warn("[PASSWORD_RESET][REQUEST] No user found for email={}",
                                                        maskEmail(email));
                                        return Mono.empty();
                                }))
                                .flatMap(user -> {
                                        String token = UUID.randomUUID().toString();
                                        LocalDateTime expiry = LocalDateTime.now().plusMinutes(15);
                                        PasswordResetToken resetToken = PasswordResetToken.builder()
                                                        .userId(user.getId())
                                                        .token(token)
                                                        .expiryDate(expiry)
                                                        .createdAt(LocalDateTime.now())
                                                        .build();

                                        log.debug("[PASSWORD_RESET][TOKEN] Generated token for userId={} tokenSuffix={} expiry={}",
                                                        user.getId(), maskToken(token), expiry);
                                        return tokenRepository.deleteByUserId(user.getId())
                                                        .doOnSuccess(unused -> log.debug(
                                                                        "[PASSWORD_RESET][TOKEN] Cleared existing tokens for userId={}",
                                                                        user.getId()))
                                                        .then(tokenRepository.save(resetToken))
                                                        .doOnSuccess(saved -> log.info(
                                                                        "[PASSWORD_RESET][TOKEN] Token persisted tokenId={} userId={} tokenSuffix={}",
                                                                        saved.getId(), user.getId(), maskToken(token)))
                                                        .then(emailService.sendPasswordResetEmail(
                                                                        user.getEmail(),
                                                                        buildPasswordResetLink(token)))
                                                        .doOnSuccess(unused -> log.info(
                                                                        "[PASSWORD_RESET][EMAIL] Reset email queued for userId={} email={}",
                                                                        user.getId(), maskEmail(user.getEmail())));
                                }).then();
        }

        /**
         * Resets a user's password using a valid reset token.
         */
        public Mono<Void> resetPassword(ResetPasswordRequest request) {
                String requestedToken = request.getToken();
                log.info("[PASSWORD_RESET][REQUEST] Reset password requested tokenSuffix={}",
                                maskToken(requestedToken));
                return tokenRepository.findByToken(request.getToken())
                                .switchIfEmpty(Mono.defer(() -> {
                                        log.warn("[PASSWORD_RESET][VALIDATION] Invalid token used tokenSuffix={}",
                                                        maskToken(requestedToken));
                                        return Mono.error(new RuntimeException("Invalid reset token"));
                                }))
                                .flatMap(token -> {
                                        log.debug("[PASSWORD_RESET][TOKEN] Token found tokenId={} userId={} tokenSuffix={} expiry={}",
                                                        token.getId(), token.getUserId(), maskToken(token.getToken()),
                                                        token.getExpiryDate());
                                        if (token.getExpiryDate().isBefore(LocalDateTime.now())) {
                                                log.warn("[PASSWORD_RESET][VALIDATION] Expired token tokenId={} userId={} tokenSuffix={}",
                                                                token.getId(), token.getUserId(),
                                                                maskToken(token.getToken()));
                                                return Mono.error(new RuntimeException("Reset token expired"));
                                        }

                                        return userRepository.findById(token.getUserId())
                                                        .switchIfEmpty(Mono.defer(() -> {
                                                                log.error("[PASSWORD_RESET][ERROR] User not found for tokenId={} userId={}",
                                                                                token.getId(), token.getUserId());
                                                                return Mono.error(new RuntimeException("User not found"));
                                                        }))
                                                        .flatMap(user -> {
                                                                log.info("[PASSWORD_RESET][UPDATE] Updating password for userId={} email={}",
                                                                                user.getId(),
                                                                                maskEmail(user.getEmail()));
                                                                user.setPassword(passwordEncoder
                                                                                .encode(request.getNewPassword()));
                                                                return userRepository.save(user)
                                                                                .then(tokenRepository.deleteById(
                                                                                                token.getId()))
                                                                                .doOnSuccess(unused -> log.info(
                                                                                                "[PASSWORD_RESET][COMPLETE] Password updated and token removed tokenId={} userId={}",
                                                                                                token.getId(),
                                                                                                user.getId()));
                                                        });
                                }).then();
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

        private String buildPasswordResetLink(String token) {
                String baseUrl = frontendBaseUrl == null ? "http://localhost:5173" : frontendBaseUrl.trim();
                if (baseUrl.endsWith("/")) {
                        baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
                }
                return baseUrl + "/reset-password?token=" + token;
        }

        private String maskEmail(String email) {
                if (email == null || email.isBlank()) {
                        return "n/a";
                }
                String normalized = email.trim().toLowerCase();
                int atIndex = normalized.indexOf('@');
                if (atIndex <= 0) {
                        return "***";
                }
                String local = normalized.substring(0, atIndex);
                String domain = normalized.substring(atIndex);
                if (local.length() == 1) {
                        return local.charAt(0) + "***" + domain;
                }
                if (local.length() == 2) {
                        return local.substring(0, 1) + "***" + domain;
                }
                return local.substring(0, 2) + "***" + domain;
        }

        private String maskToken(String token) {
                if (token == null || token.isBlank()) {
                        return "n/a";
                }
                String compact = token.replace("-", "");
                if (compact.length() <= 6) {
                        return "***";
                }
                return "***" + compact.substring(compact.length() - 6);
        }

}
