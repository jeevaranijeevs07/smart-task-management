package com.smarttask;

import com.smarttask.workspace.service.WorkspaceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import reactor.test.StepVerifier;

@SpringBootTest
public class RemoveMemberIntegrationTest {

    @Autowired
    private WorkspaceService workspaceService;

    @Test
    public void testRemoveMember() {
        workspaceService.removeMemberFromWorkspace(1L, 1L, 2L)
                .as(StepVerifier::create)
                .verifyComplete();
    }
}
