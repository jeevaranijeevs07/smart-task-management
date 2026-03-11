/**
 * Project: Smart Task Management
 * Layer: Configuration
 * Component: User
 * Description: Application configuration and settings.
 */
package com.smarttask.config;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.beans.factory.annotation.Value;
import org.flywaydb.core.Flyway;

@Component
@RequiredArgsConstructor
public class DbSeedCommandLineRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DbSeedCommandLineRunner.class);
    private final DatabaseClient databaseClient;

    @Value("${spring.flyway.url}")
    private String flywayUrl;

    @Value("${spring.flyway.user}")
    private String flywayUser;

    @Value("${spring.flyway.password}")
    private String flywayPassword;

    @Override
    public void run(String... args) {

        Flyway flyway = Flyway.configure()
                .dataSource(flywayUrl, flywayUser, flywayPassword)
                .baselineOnMigrate(true)
                .load();
        flyway.repair();
        flyway.migrate();

        databaseClient.sql("SELECT 1").fetch().first()
                .subscribe(
                        result -> {
                        },
                        error -> log.error("Error connecting to Database: ", error));

        if (args.length > 0 && args[0].equals("--seed")) {
        }
    }
}
