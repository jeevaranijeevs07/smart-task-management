/**
 * Project: Smart Task Management
 * Component: Email Service
 * Description: Handles outgoing email communications, primarily for workspace invitations and account-related alerts.
 */
package com.smarttask.notification.service;

import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.nio.charset.StandardCharsets;

@Service
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    private final boolean mailEnabled;
    private final String mailHost;
    private final String mailUsername;
    private final String configuredFromAddress;

    public EmailService(
            JavaMailSender mailSender,
            @Value("${app.mail.enabled:false}") boolean mailEnabled,
            @Value("${spring.mail.host:}") String mailHost,
            @Value("${spring.mail.username:}") String mailUsername,
            @Value("${app.mail.from:}") String configuredFromAddress) {
        this.mailSender = mailSender;
        this.mailEnabled = mailEnabled;
        this.mailHost = mailHost;
        this.mailUsername = mailUsername;
        this.configuredFromAddress = configuredFromAddress;
    }

    /**
     * Constructs and sends a workspace invitation email if mail services are
     * enabled.
     */
    public Mono<Void> sendInvitationEmail(String toEmail, String workspaceName, String inviteLink) {
        if (!mailEnabled) {
            log.info("[EMAIL][INVITATION] Delivery disabled. Skipping invitation email to={}", maskEmail(toEmail));
            return Mono.empty();
        }
        if (mailHost == null || mailHost.isBlank()) {
            log.warn("[EMAIL][INVITATION] spring.mail.host missing. Skipping invitation email to={}",
                    maskEmail(toEmail));
            return Mono.empty();
        }

        final String fromAddress = resolveFromAddress();
        final String subject = "Invitation to join workspace: " + workspaceName;
        final String body = buildInvitationBody(workspaceName, inviteLink);
        log.debug("[EMAIL][INVITATION] Preparing message from={} to={} host={} workspace={}",
                fromAddress, maskEmail(toEmail), mailHost, workspaceName);

        return Mono.fromCallable(() -> {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setTo(toEmail);
            helper.setFrom(fromAddress);
            helper.setSubject(subject);
            helper.setText(body, false);
            mailSender.send(message);
            return true;
        })
                .subscribeOn(Schedulers.boundedElastic())
                .doOnSuccess(ignored -> log.info("[EMAIL][INVITATION] Sent invitation email to={}",
                        maskEmail(toEmail)))
                .doOnError(error -> log.error("[EMAIL][INVITATION] Failed to send invitation email to={} reason={}",
                        maskEmail(toEmail), error.getMessage(),
                        error))
                .then();
    }

    /**
     * Constructs and sends a password reset email if mail services are enabled.
     */
    public Mono<Void> sendPasswordResetEmail(String toEmail, String resetLink) {
        if (!mailEnabled) {
            log.info("[EMAIL][PASSWORD_RESET] Delivery disabled. Skipping password reset email to={}",
                    maskEmail(toEmail));
            return Mono.empty();
        }
        if (mailHost == null || mailHost.isBlank()) {
            log.warn("[EMAIL][PASSWORD_RESET] spring.mail.host missing. Skipping password reset email to={}",
                    maskEmail(toEmail));
            return Mono.empty();
        }

        final String fromAddress = resolveFromAddress();
        final String subject = "Reset your SmartTask password";
        final String body = buildPasswordResetBody(resetLink);
        log.debug("[EMAIL][PASSWORD_RESET] Preparing message from={} to={} host={}",
                fromAddress, maskEmail(toEmail), mailHost);

        return Mono.fromCallable(() -> {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setTo(toEmail);
            helper.setFrom(fromAddress);
            helper.setSubject(subject);
            helper.setText(body, false);
            mailSender.send(message);
            return true;
        })
                .subscribeOn(Schedulers.boundedElastic())
                .doOnSuccess(ignored -> log.info("[EMAIL][PASSWORD_RESET] Sent password reset email to={}",
                        maskEmail(toEmail)))
                .doOnError(error -> log.error("[EMAIL][PASSWORD_RESET] Failed to send password reset email to={} reason={}",
                        maskEmail(toEmail),
                        error.getMessage(), error))
                .then();
    }

    /**
     * Sends a workspace-added notification email for users who were directly added.
     */
    public Mono<Void> sendWorkspaceAddedEmail(String toEmail, String workspaceName) {
        if (!mailEnabled) {
            log.info("[EMAIL][WORKSPACE_ADDED] Delivery disabled. Skipping workspace-added email to={}",
                    maskEmail(toEmail));
            return Mono.empty();
        }
        if (mailHost == null || mailHost.isBlank()) {
            log.warn("[EMAIL][WORKSPACE_ADDED] spring.mail.host missing. Skipping workspace-added email to={}",
                    maskEmail(toEmail));
            return Mono.empty();
        }

        String safeWorkspaceName = (workspaceName == null || workspaceName.isBlank()) ? "Workspace" : workspaceName;
        final String fromAddress = resolveFromAddress();
        final String subject = "You've been added to workspace: " + safeWorkspaceName;
        final String body = buildWorkspaceAddedBody(safeWorkspaceName);
        log.debug("[EMAIL][WORKSPACE_ADDED] Preparing message from={} to={} host={} workspace={}",
                fromAddress, maskEmail(toEmail), mailHost, safeWorkspaceName);

        return Mono.fromCallable(() -> {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setTo(toEmail);
            helper.setFrom(fromAddress);
            helper.setSubject(subject);
            helper.setText(body, false);
            mailSender.send(message);
            return true;
        })
                .subscribeOn(Schedulers.boundedElastic())
                .doOnSuccess(ignored -> log.info("[EMAIL][WORKSPACE_ADDED] Sent workspace-added email to={}",
                        maskEmail(toEmail)))
                .doOnError(error -> log.error("[EMAIL][WORKSPACE_ADDED] Failed to send workspace-added email to={} reason={}",
                        maskEmail(toEmail), error.getMessage(), error))
                .then();
    }

    /**
     * Determines the sender address based on application configuration.
     */
    private String resolveFromAddress() {
        if (configuredFromAddress != null && !configuredFromAddress.isBlank()) {
            return configuredFromAddress;
        }
        if (mailUsername != null && !mailUsername.isBlank()) {
            return mailUsername;
        }
        return "no-reply@smarttask.local";
    }

    /**
     * Generates the plain-text body for invitation emails.
     */
    private String buildInvitationBody(String workspaceName, String inviteLink) {
        return "Hello,\n\n"
                + "You have been invited to join the workspace \"" + workspaceName + "\".\n"
                + "Use this link to accept the invitation:\n"
                + inviteLink + "\n\n"
                + "If you were not expecting this invitation, you can ignore this email.\n\n"
                + "Smart Task Team";
    }

    /**
     * Generates the plain-text body for password reset emails.
     */
    private String buildPasswordResetBody(String resetLink) {
        return "Hello,\n\n"
                + "We received a request to reset your SmartTask password.\n"
                + "Use this link to set a new password (valid for 15 minutes):\n"
                + resetLink + "\n\n"
                + "If you did not request a password reset, you can ignore this email.\n\n"
                + "Smart Task Team";
    }

    /**
     * Generates the plain-text body for direct workspace-added emails.
     */
    private String buildWorkspaceAddedBody(String workspaceName) {
        return "Hello,\n\n"
                + "You have been added to the workspace \"" + workspaceName + "\".\n"
                + "Sign in to SmartTask to start collaborating.\n\n"
                + "Smart Task Team";
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
}
