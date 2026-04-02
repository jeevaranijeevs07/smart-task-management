package com.smarttask.common.security;

import com.smarttask.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.ReactiveUserDetailsService;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.Collections;

/**
 * Custom implementation of ReactiveUserDetailsService to load user credentials 
 * from the database for Spring Security authentication.
 */
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements ReactiveUserDetailsService {

    private final UserRepository userRepository;

    @Override
    public Mono<UserDetails> findByUsername(String email) {
        return userRepository.findByEmail(email)
                .map(user -> org.springframework.security.core.userdetails.User.builder()
                        .username(user.getId().toString())
                        .password(user.getPassword())
                        .authorities(Collections.singletonList(
                                new SimpleGrantedAuthority("ROLE_" + user.getSystemRole().name())))
                        .build());
    }
}
