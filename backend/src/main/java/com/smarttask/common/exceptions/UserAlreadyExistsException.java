/**
 * Project: Smart Task Management
 * Component: User
 * Description: Backend component for Smart Task Management
 */
package com.smarttask.common.exceptions;

public class UserAlreadyExistsException extends RuntimeException {

    public UserAlreadyExistsException(String message) {
        super(message);
    }
}

