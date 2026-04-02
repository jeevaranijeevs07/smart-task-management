package com.smarttask.common.security;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.util.Collections;

@RequiredArgsConstructor
public class JwtAuthenticationFilter implements WebFilter {

    private static final Logger logger =
            LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private final JwtService jwtService;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {

        String path = exchange.getRequest().getURI().getPath();
        if (path.startsWith("/ws/notifications") || path.startsWith("/api/sse/updates")) {
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest()
                .getHeaders()
                .getFirst(HttpHeaders.AUTHORIZATION);

        String token = null;

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        } else {
            token = exchange.getRequest().getQueryParams().getFirst("token");
        }

        if (token == null || token.isBlank()) {
            return chain.filter(exchange);
        }

        try {
            String userId = jwtService.extractUserId(token);
            String role = jwtService.extractRole(token);

            logger.info("JWT Filter: Authenticating user {} with role {}", userId, role);

            java.util.List<org.springframework.security.core.authority.SimpleGrantedAuthority> authorities =
                    role != null
                            ? Collections.singletonList(
                                    new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_" + role))
                            : Collections.emptyList();

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(userId, null, authorities);

            logger.info("JWT Filter: Setting authentication in context");

            return chain.filter(exchange)
                    .contextWrite(
                            ReactiveSecurityContextHolder
                                    .withAuthentication(authentication));

        } catch (Exception e) {
            logger.error("JWT Filter Error: {}", e.getMessage());
            return chain.filter(exchange);
        }
    }
}