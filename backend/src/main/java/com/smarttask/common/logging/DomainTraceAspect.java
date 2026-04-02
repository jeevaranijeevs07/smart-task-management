package com.smarttask.common.logging;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Emits category-wise trace logs for domain controller/service executions.
 * Logger name is the target class so logback package-based routing applies.
 */
@Aspect
@Component
public class DomainTraceAspect {

    @Around(
            "execution(* com.smarttask.card.controller..*(..)) || " +
                    "execution(* com.smarttask.card.service..*(..)) || " +
                    "execution(* com.smarttask.board.controller..*(..)) || " +
                    "execution(* com.smarttask.board.service..*(..)) || " +
                    "execution(* com.smarttask.workspace.controller..*(..)) || " +
                    "execution(* com.smarttask.workspace.service..*(..)) || " +
                    "execution(* com.smarttask.user.controller..*(..)) || " +
                    "execution(* com.smarttask.user.service..*(..)) || " +
                    "execution(* com.smarttask.activity.controller..*(..)) || " +
                    "execution(* com.smarttask.activity.service..*(..)) || " +
                    "execution(* com.smarttask.notification.controller..*(..)) || " +
                    "execution(* com.smarttask.notification.service..*(..)) || " +
                    "execution(* com.smarttask.notification.scheduler..*(..)) || " +
                    "execution(* com.smarttask.notification.websocket..*(..))")
    public Object traceDomainCall(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        String className = signature.getDeclaringTypeName();
        String methodName = signature.getName();
        long startNanos = System.nanoTime();
        
        Logger targetLog = LoggerFactory.getLogger(className);

        targetLog.debug("[TRACE][ENTER] {}.{}()", className, methodName);
        try {
            Object result = joinPoint.proceed();
            long elapsedMs = (System.nanoTime() - startNanos) / 1_000_000;
            targetLog.debug("[TRACE][EXIT] {}.{}() completed in {} ms", className, methodName, elapsedMs);
            return result;
        } catch (Throwable throwable) {
            long elapsedMs = (System.nanoTime() - startNanos) / 1_000_000;
            targetLog.error("[TRACE][ERROR] {}.{}() failed in {} ms: {}",
                    className, methodName, elapsedMs, throwable.getMessage(), throwable);
            throw throwable;
        }
    }
}
