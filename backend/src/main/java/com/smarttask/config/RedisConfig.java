package com.smarttask.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.ReactiveRedisConnectionFactory;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.cache.Cache;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;

/**
 * Project: Smart Task Management
 * Component: Redis Configuration
 * Description: Sets up Reactive Redis templates and enables caching abstraction.
 */
@Configuration
@EnableCaching
@Slf4j
public class RedisConfig implements CachingConfigurer {

    @Bean
    public ReactiveRedisTemplate<String, Object> reactiveRedisTemplate(ReactiveRedisConnectionFactory factory) {
        RedisSerializationContext<String, Object> context = RedisSerializationContext
                .<String, Object>newSerializationContext(new StringRedisSerializer())
                .value(RedisSerializer.json())
                .hashValue(RedisSerializer.json())
                .build();
        return new ReactiveRedisTemplate<>(factory, context);
    }

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofHours(1))
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(RedisSerializer.json()));

        return RedisCacheManager.builder(factory)
                .cacheDefaults(config)
                .build();
    }

    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
                log.error("[CACHE] Failed to GET from '{}' for key {}: {}", cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
                log.error("[CACHE] Failed to PUT to '{}' for key {}: {}", cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
                log.error("[CACHE] Failed to EVICT from '{}' for key {}: {}", cache.getName(), key, exception.getMessage());
            }

            @Override
            public void handleCacheClearError(RuntimeException exception, Cache cache) {
                log.error("[CACHE] Failed to CLEAR cache '{}': {}", cache.getName(), exception.getMessage());
            }
        };
    }
}
