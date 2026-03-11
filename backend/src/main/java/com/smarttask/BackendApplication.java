/**
 * Project: Smart Task Management
 * Component: User
 * Description: Backend component for Smart Task Management
 */
package com.smarttask;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication // Enables auto-configuration and component scanning in Spring Boot
@EnableScheduling // Enables @Scheduled methods for cron/periodic tasks
public class BackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(BackendApplication.class, args);
	}

}
