package com.smarttask.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import org.springframework.web.cors.reactive.CorsConfigurationSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.core.io.buffer.DataBuffer;
import reactor.core.publisher.Mono;
import java.nio.charset.StandardCharsets;

@Configuration
@EnableWebFluxSecurity
@RequiredArgsConstructor
public class SecurityConfig {

        private final com.smarttask.common.security.CustomUserDetailsService userDetailsService;

        @Bean
        public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http,
                        com.smarttask.common.security.JwtService jwtService) {
                com.smarttask.common.security.JwtAuthenticationFilter jwtFilter = new com.smarttask.common.security.JwtAuthenticationFilter(
                                jwtService);

                return http
                                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                                .exceptionHandling(exceptionHandlingSpec -> exceptionHandlingSpec
                                                .authenticationEntryPoint((exchange, e) -> {
                                                        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                                                        exchange.getResponse().getHeaders()
                                                                        .setContentType(MediaType.APPLICATION_JSON);
                                                        String errorResponse = "{\"error\": \"Protected endpoint accessed! (401 Unauthorized)\"}";
                                                        byte[] bytes = errorResponse.getBytes(StandardCharsets.UTF_8);
                                                        DataBuffer buffer = exchange.getResponse().bufferFactory()
                                                                        .wrap(bytes);
                                                        return exchange.getResponse().writeWith(Mono.just(buffer));
                                                })
                                                .accessDeniedHandler((exchange, e) -> {
                                                        exchange.getResponse().setStatusCode(HttpStatus.FORBIDDEN);
                                                        exchange.getResponse().getHeaders()
                                                                        .setContentType(MediaType.APPLICATION_JSON);
                                                        String errorResponse = "{\"error\": \"Role-Based Access Control denied access. (403 Forbidden)\"}";
                                                        byte[] bytes = errorResponse.getBytes(StandardCharsets.UTF_8);
                                                        DataBuffer buffer = exchange.getResponse().bufferFactory()
                                                                        .wrap(bytes);
                                                        return exchange.getResponse().writeWith(Mono.just(buffer));
                                                }))
                                .addFilterBefore(jwtFilter,
                                                org.springframework.security.config.web.server.SecurityWebFiltersOrder.AUTHENTICATION)
                                .authorizeExchange(exchanges -> exchanges
                                                .pathMatchers("/api/users/register", "/api/users/login",
                                                                "/api/users/forgot-password",
                                                                "/api/users/reset-password",
                                                                "/api/sse/**",
                                                                "/ws/**")
                                                .permitAll()
                                                .pathMatchers("/api/users/admin").hasRole("ADMIN")
                                                .anyExchange().authenticated())
                                .build();
        }

        @Bean
        public org.springframework.security.authentication.ReactiveAuthenticationManager reactiveAuthenticationManager(
                        PasswordEncoder passwordEncoder) {
                org.springframework.security.authentication.UserDetailsRepositoryReactiveAuthenticationManager authenticationManager = new org.springframework.security.authentication.UserDetailsRepositoryReactiveAuthenticationManager(
                                userDetailsService);
                authenticationManager.setPasswordEncoder(passwordEncoder);
                return authenticationManager;
        }

        @Bean
        public CorsConfigurationSource corsConfigurationSource() {
                CorsConfiguration config = new CorsConfiguration();
                config.setAllowCredentials(true);
                config.addAllowedOrigin("http://localhost:5173");
                config.addAllowedHeader("*");
                config.addAllowedMethod("*");
                config.setMaxAge(3600L);
                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
                source.registerCorsConfiguration("/**", config);
                return source;
        }

        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder();
        }
}