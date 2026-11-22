package com.verdikt.api.service;

import com.verdikt.api.MediaItem;
import com.verdikt.api.MediaType;
import com.verdikt.api.repository.MediaItemRepository;
import com.verdikt.api.service.external.UnifiedMediaSearchService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/** Local search never returns the whole table, and skips queries too short to mean anything. */
@SpringBootTest
@ActiveProfiles("test")
class SearchLimitsTest {

    @Autowired MediaItemService mediaItemService;
    @Autowired MediaItemRepository mediaItemRepository;
    @MockitoBean UnifiedMediaSearchService providers;

    private final String marker = "zq" + UUID.randomUUID().toString().substring(0, 6);

    @BeforeEach
    void setUp() {
        when(providers.search(anyString(), anyString(), anyInt())).thenReturn(List.of());
        IntStream.range(0, 50).forEach(i -> mediaItemRepository.save(MediaItem.builder()
                .externalId(marker + i).mediaType(MediaType.MOVIE).title(marker + " part " + i).build()));
    }

    @Test
    void localMatchesAreCapped() {
        assertThat(mediaItemService.searchMedia(marker, "ALL", 1)).hasSize(MediaItemService.LOCAL_RESULT_LIMIT);
    }

    @Test
    void blankAndOneLetterQueriesSkipTheTableScan() {
        assertThat(mediaItemService.searchMedia("", "ALL", 1)).isEmpty();
        assertThat(mediaItemService.searchMedia("z", "ALL", 1)).isEmpty();
    }

    @Test
    void laterPagesOnlyComeFromProviders() {
        assertThat(mediaItemService.searchMedia(marker, "ALL", 2)).isEmpty();
    }
}
