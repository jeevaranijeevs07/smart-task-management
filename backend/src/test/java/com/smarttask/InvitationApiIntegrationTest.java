package com.smarttask;

import com.smarttask.common.entities.enums.WorkspaceRole;
import com.smarttask.workspace.dto.InviteMemberRequestDTO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.reactive.server.WebTestClient;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(com.smarttask.common.security.JwtService.class)
public class InvitationApiIntegrationTest {

    @Autowired
    private WebTestClient webTestClient;

    @Autowired
    private com.smarttask.common.security.JwtService jwtService;

    @Test
    public void testInviteMemberApi() {
        String token = jwtService.generateToken("1", com.smarttask.common.entities.enums.SystemRole.ADMIN.name());

        InviteMemberRequestDTO request = new InviteMemberRequestDTO();
        request.setEmail("thisuserdoesnotexist777@gmail.com");
        request.setRole(WorkspaceRole.MEMBER);

        webTestClient.post()
                .uri("/api/workspaces/7/invitations")
                .header("Authorization", "Bearer " + token)
                .bodyValue(request)
                .exchange()
                .expectStatus().is2xxSuccessful();
    }
}
