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
            log.info("Email delivery disabled. Skipping invitation email to {}", toEmail);
            return Mono.empty();
        }
        if (mailHost == null || mailHost.isBlank()) {
            log.warn("spring.mail.host is not configured. Skipping invitation email to {}", toEmail);
            return Mono.empty();
        }

        final String fromAddress = resolveFromAddress();
        final String subject = "Invitation to join workspace: " + workspaceName;
        final String body = buildInvitationBody(workspaceName, inviteLink);

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
                .doOnSuccess(ignored -> log.info("Invitation email sent to {}", toEmail))
                .doOnError(error -> log.error("Failed to send invitation email to {}: {}", toEmail, error.getMessage(),
                        error))
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
}
