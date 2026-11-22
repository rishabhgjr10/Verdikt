package com.verdikt.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.verdikt.api.dto.AuthRequest;
import com.verdikt.api.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** "Sign out of all devices" revokes every earlier token and keeps the asking device signed in. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SessionRevocationWebTest {

    @Autowired MockMvc mvc;
    @Autowired AuthService authService;
    @Autowired ObjectMapper json;

    @Test
    void revokingSessionsInvalidatesOlderTokens() throws Exception {
        String name = "sess" + UUID.randomUUID().toString().substring(0, 8);
        String oldToken = authService.register(AuthRequest.builder()
                .username(name).email(name + "@example.test").password("correct horse").build()).getToken();

        mvc.perform(get("/api/me/profile").header("Authorization", "Bearer " + oldToken)).andExpect(status().isOk());

        String body = mvc.perform(post("/api/me/sessions/revoke").header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String newToken = json.readTree(body).get("token").asText();

        mvc.perform(get("/api/me/profile").header("Authorization", "Bearer " + oldToken)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me/profile").header("Authorization", "Bearer " + newToken)).andExpect(status().isOk());
    }
}
