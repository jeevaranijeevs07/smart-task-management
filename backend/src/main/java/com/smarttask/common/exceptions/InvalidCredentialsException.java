/**
 * Project: Smart Task Management
 * Component: User
 * Description: Backend component for Smart Task Management
 */
package com.smarttask.common.exceptions;

public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException(String message) {
        super(message);
    }
}

