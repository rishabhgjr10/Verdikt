package com.verdikt.api.controller;

import com.verdikt.api.MediaItem;
import com.verdikt.api.User;
import com.verdikt.api.repository.CollectionItemRepository;
import com.verdikt.api.repository.MediaCollectionRepository;
import com.verdikt.api.repository.MediaItemRepository;
import com.verdikt.api.repository.UserMediaStateRepository;
import com.verdikt.api.repository.UserRepository;
import com.verdikt.api.service.CollectionService;
import com.verdikt.api.service.CollectionService.CreateCollectionRequest;
import com.verdikt.api.service.external.TmdbService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** HTTP-level checks: 401 when logged out, 403 for system collections, 404 for other users' collections. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UserMediaSecurityWebTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository userRepository;
    @Autowired MediaItemRepository mediaItemRepository;
    @Autowired UserMediaStateRepository stateRepository;
    @Autowired MediaCollectionRepository collectionRepository;
    @Autowired CollectionItemRepository collectionItemRepository;
    @Autowired CollectionService collectionService;

    @MockitoBean TmdbService tmdbService;

    private UUID mediaId;

    @BeforeEach
    void setUp() {
        when(tmdbService.searchMovies(anyString(), anyInt())).thenReturn(List.of());
        when(tmdbService.searchSeries(anyString(), anyInt())).thenReturn(List.of());
        userRepository.save(User.builder().username("alice").email("alice@test.local").passwordHash("x").build());
        userRepository.save(User.builder().username("bob").email("bob@test.local").passwordHash("x").build());
        mediaId = mediaItemRepository.save(MediaItem.builder().externalId("438631")
                .mediaType(com.verdikt.api.MediaType.MOVIE).title("Dune").build()).getId();
    }

    @AfterEach
    void cleanUp() {
        collectionItemRepository.deleteAllInBatch();
        collectionRepository.deleteAllInBatch();
        stateRepository.deleteAllInBatch();
        mediaItemRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();
    }

    @Test
    void loggedOutCallsReturn401() throws Exception {
        mvc.perform(get("/api/media/{id}/me", mediaId)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
        mvc.perform(put("/api/media/{id}/watched", mediaId).contentType(MediaType.APPLICATION_JSON).content("{\"value\":true}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(put("/api/media/{id}/watch-later", mediaId).contentType(MediaType.APPLICATION_JSON).content("{\"value\":true}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/collections")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me/watch-later")).andExpect(status().isUnauthorized());
    }

    @Test
    void mostInterestedIsPublic() throws Exception {
        mvc.perform(get("/api/media/most-interested").param("period", "WEEK").param("limit", "5"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/media/most-interested").param("period", "NOPE")).andExpect(status().isBadRequest());
    }

    @Test
    void systemCollectionEditsReturn403() throws Exception {
        mvc.perform(put("/api/media/{id}/watched", mediaId).with(user("alice"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"value\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.watched").value(true));
        UUID watchHistoryId = collectionService.list("alice").get(0).id();

        mvc.perform(patch("/api/collections/{id}", watchHistoryId).with(user("alice"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Renamed\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("This collection is managed automatically and can't be changed."));
        mvc.perform(delete("/api/collections/{id}", watchHistoryId).with(user("alice"))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/collections/{id}/items/{m}", watchHistoryId, mediaId).with(user("alice")))
                .andExpect(status().isForbidden());
    }

    @Test
    void anotherUsersCollectionReturns404() throws Exception {
        UUID aliceCollection = collectionService.create("alice", new CreateCollectionRequest("Mine", null, false, null)).id();

        mvc.perform(get("/api/collections/{id}", aliceCollection).with(user("bob"))).andExpect(status().isNotFound());
        mvc.perform(patch("/api/collections/{id}", aliceCollection).with(user("bob"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Hijacked\"}")).andExpect(status().isNotFound());
        mvc.perform(put("/api/collections/{id}/items/{m}", aliceCollection, mediaId).with(user("bob")))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/collections/{id}", aliceCollection).with(user("bob"))).andExpect(status().isNotFound());
    }

    @Test
    void malformedInputReturns400NotSql() throws Exception {
        mvc.perform(get("/api/media/{id}/me", "not-a-uuid").with(user("alice"))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Malformed request."));
        mvc.perform(put("/api/media/{id}/watched", mediaId).with(user("alice"))
                .contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isBadRequest());
    }
}
