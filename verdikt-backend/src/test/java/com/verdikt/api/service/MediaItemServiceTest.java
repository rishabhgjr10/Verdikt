package com.verdikt.api.service;

import com.verdikt.api.MediaItem;
import com.verdikt.api.MediaType;
import com.verdikt.api.dto.MediaItemDTO;
import com.verdikt.api.exception.ExternalProviderException;
import com.verdikt.api.exception.GlobalExceptionHandler;
import com.verdikt.api.exception.ResourceNotFoundException;
import com.verdikt.api.repository.MediaItemRepository;
import com.verdikt.api.service.external.UnifiedMediaSearchService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Example;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.repository.query.FluentQuery;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MediaItemServiceTest {

    private InMemoryMediaItemRepository repository;
    private StubUnifiedMediaSearchService searchService;
    private MediaItemService mediaItemService;
    private final GlobalExceptionHandler exceptionHandler = new GlobalExceptionHandler();

    @BeforeEach
    void setUp() {
        repository = new InMemoryMediaItemRepository();
        searchService = new StubUnifiedMediaSearchService();
        mediaItemService = new MediaItemService(repository, searchService);
    }

    @Test
    @DisplayName("1. First click on a new anime (SERIES/30984) returns 200 with mediaType ANIME")
    void testFirstClickOnNewAnime_ReturnsAnime() {
        String extId = "30984";
        searchService.registerDetails(extId, MediaType.SERIES,
                MediaItemDTO.builder()
                        .externalId(extId)
                        .mediaType(MediaType.ANIME)
                        .title("Bleach")
                        .releaseYear(2004)
                        .build());

        MediaItem result = mediaItemService.getOrCreateMediaItem(extId, MediaType.SERIES);

        assertThat(result).isNotNull();
        assertThat(result.getMediaType()).isEqualTo(MediaType.ANIME);
        assertThat(result.getTitle()).isEqualTo("Bleach");
        assertThat(repository.saveCount.get()).isEqualTo(1);
    }

    @Test
    @DisplayName("2. Second click on the same title returns from DB without provider call")
    void testSecondClickOnSameTitle_ReturnsFromDbWithoutProviderCall() {
        String extId = "30984";
        MediaItem existingAnime = MediaItem.builder()
                .id(UUID.randomUUID())
                .externalId(extId)
                .mediaType(MediaType.ANIME)
                .title("Bleach")
                .build();
        repository.store.put(extId + "-ANIME", existingAnime);

        // When second request arrives as SERIES
        MediaItem result = mediaItemService.getOrCreateMediaItem(extId, MediaType.SERIES);

        assertThat(result).isNotNull();
        assertThat(result.getMediaType()).isEqualTo(MediaType.ANIME);
        assertThat(searchService.callCount.get()).isEqualTo(0);
        assertThat(repository.saveCount.get()).isEqualTo(0);
    }

    @Test
    @DisplayName("3. 10 parallel requests for the same new id all succeed and row is saved safely")
    void testParallelRequestsForSameNewId_AllSucceed() throws InterruptedException {
        String extId = "73223";
        searchService.registerDetails(extId, MediaType.SERIES,
                MediaItemDTO.builder()
                        .externalId(extId)
                        .mediaType(MediaType.ANIME)
                        .title("Black Clover")
                        .releaseYear(2017)
                        .build());

        int numThreads = 10;
        ExecutorService executor = Executors.newFixedThreadPool(numThreads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(numThreads);
        AtomicInteger successCount = new AtomicInteger(0);

        for (int i = 0; i < numThreads; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();
                    MediaItem item = mediaItemService.getOrCreateMediaItem(extId, MediaType.SERIES);
                    if (item != null && item.getMediaType() == MediaType.ANIME && "Black Clover".equals(item.getTitle())) {
                        successCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        doneLatch.await();
        executor.shutdown();

        assertThat(successCount.get()).isEqualTo(10);
        assertThat(repository.saveCount.get()).isEqualTo(1);
    }

    @Test
    @DisplayName("4. Normal series, movie, game and book still work")
    void testNormalSeriesMovieGameBook_AllWork() {
        // Normal Series
        searchService.registerDetails("1396", MediaType.SERIES,
                MediaItemDTO.builder().externalId("1396").mediaType(MediaType.SERIES).title("Breaking Bad").build());
        MediaItem series = mediaItemService.getOrCreateMediaItem("1396", MediaType.SERIES);
        assertThat(series.getMediaType()).isEqualTo(MediaType.SERIES);
        assertThat(series.getTitle()).isEqualTo("Breaking Bad");

        // Movie
        searchService.registerDetails("693134", MediaType.MOVIE,
                MediaItemDTO.builder().externalId("693134").mediaType(MediaType.MOVIE).title("Dune: Part Two").build());
        MediaItem movie = mediaItemService.getOrCreateMediaItem("693134", MediaType.MOVIE);
        assertThat(movie.getMediaType()).isEqualTo(MediaType.MOVIE);

        // Game
        searchService.registerDetails("1020", MediaType.GAME,
                MediaItemDTO.builder().externalId("1020").mediaType(MediaType.GAME).title("Zelda").build());
        MediaItem game = mediaItemService.getOrCreateMediaItem("1020", MediaType.GAME);
        assertThat(game.getMediaType()).isEqualTo(MediaType.GAME);

        // Book
        searchService.registerDetails("book123", MediaType.BOOK,
                MediaItemDTO.builder().externalId("book123").mediaType(MediaType.BOOK).title("The Hobbit").build());
        MediaItem book = mediaItemService.getOrCreateMediaItem("book123", MediaType.BOOK);
        assertThat(book.getMediaType()).isEqualTo(MediaType.BOOK);
    }

    @Test
    @DisplayName("5. Bad ID or provider errors return clean 404 or 502 with no SQL leakage")
    void testBadIdReturnsCleanErrorWithoutSql() {
        // 404 Not Found
        searchService.registerError("bad-404", MediaType.MOVIE,
                new ResourceNotFoundException("Movie not found with external id: bad-404"));

        assertThatThrownBy(() -> mediaItemService.getOrCreateMediaItem("bad-404", MediaType.MOVIE))
                .isInstanceOf(ResourceNotFoundException.class);

        ResponseEntity<Map<String, Object>> resp404 = exceptionHandler.handleResourceNotFound(
                new ResourceNotFoundException("Movie not found with external id: bad-404"));
        assertThat(resp404.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(resp404.getBody()).containsEntry("code", 404);
        assertThat(resp404.getBody().get("message").toString()).doesNotContain("SQL", "media_items", "uk_media");

        // 502 Bad Gateway
        ResponseEntity<Map<String, Object>> resp502 = exceptionHandler.handleExternalProviderException(
                new ExternalProviderException("External provider (TMDB) failed or timed out for ID: bad-502"));
        assertThat(resp502.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertThat(resp502.getBody()).containsEntry("code", 502);
        assertThat(resp502.getBody().get("message").toString()).doesNotContain("SQL", "media_items", "uk_media");

        // DB Data Integrity violation (no SQL leakage in response)
        ResponseEntity<Map<String, Object>> respConflict = exceptionHandler.handleDataIntegrityViolation(
                new DataIntegrityViolationException("Duplicate entry '73223-ANIME' for key 'media_items.uk_media_external_type'"));
        assertThat(respConflict.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(respConflict.getBody().get("message").toString()).doesNotContain("SQL", "media_items", "uk_media_external_type");
        assertThat(respConflict.getBody().get("message").toString()).isEqualTo("A data conflict occurred. Please retry.");
    }

    // ──────────────────────── Test Stubs / Fakes ────────────────────────

    static class StubUnifiedMediaSearchService extends UnifiedMediaSearchService {
        final Map<String, MediaItemDTO> responses = new ConcurrentHashMap<>();
        final Map<String, RuntimeException> errors = new ConcurrentHashMap<>();
        final AtomicInteger callCount = new AtomicInteger(0);

        public StubUnifiedMediaSearchService() {
            super(null, null, null);
        }

        public void registerDetails(String externalId, MediaType mediaType, MediaItemDTO dto) {
            responses.put(mediaType + ":" + externalId, dto);
        }

        public void registerError(String externalId, MediaType mediaType, RuntimeException ex) {
            errors.put(mediaType + ":" + externalId, ex);
        }

        @Override
        public MediaItemDTO fetchExternalDetails(String externalId, MediaType mediaType) {
            callCount.incrementAndGet();
            String key = mediaType + ":" + externalId;
            if (errors.containsKey(key)) {
                throw errors.get(key);
            }
            return responses.get(key);
        }
    }

    static class InMemoryMediaItemRepository implements MediaItemRepository {
        final Map<String, MediaItem> store = new ConcurrentHashMap<>();
        final AtomicInteger saveCount = new AtomicInteger(0);

        @Override
        public Optional<MediaItem> findByExternalIdAndMediaType(String externalId, MediaType mediaType) {
            return Optional.ofNullable(store.get(externalId + "-" + mediaType));
        }

        @Override
        public Optional<MediaItem> findFirstByExternalIdAndMediaTypeIn(String externalId, Collection<MediaType> mediaTypes) {
            for (MediaType type : mediaTypes) {
                MediaItem item = store.get(externalId + "-" + type);
                if (item != null) {
                    return Optional.of(item);
                }
            }
            return Optional.empty();
        }

        @Override
        public <S extends MediaItem> S save(S entity) {
            String key = entity.getExternalId() + "-" + entity.getMediaType();
            if (store.putIfAbsent(key, entity) != null) {
                throw new DataIntegrityViolationException("Duplicate entry '" + key + "' for key 'media_items.uk_media_external_type'");
            }
            saveCount.incrementAndGet();
            return entity;
        }

        @Override
        public Optional<MediaItem> findById(UUID id) {
            return store.values().stream().filter(m -> Objects.equals(m.getId(), id)).findFirst();
        }

        @Override public List<MediaItem> findByMediaType(MediaType mediaType) { return Collections.emptyList(); }
        @Override public List<MediaItem> findByTitleContainingIgnoreCase(String title) { return Collections.emptyList(); }
        @Override public List<MediaItem> findByMediaTypeAndTitleContainingIgnoreCase(MediaType mediaType, String title) { return Collections.emptyList(); }
        @Override public void flush() {}
        @Override public <S extends MediaItem> S saveAndFlush(S entity) { return save(entity); }
        @Override public <S extends MediaItem> List<S> saveAllAndFlush(Iterable<S> entities) { return Collections.emptyList(); }
        @Override public void deleteAllInBatch(Iterable<MediaItem> entities) {}
        @Override public void deleteAllByIdInBatch(Iterable<UUID> uuids) {}
        @Override public void deleteAllInBatch() {}
        @Override public MediaItem getOne(UUID uuid) { return null; }
        @Override public MediaItem getById(UUID uuid) { return null; }
        @Override public MediaItem getReferenceById(UUID uuid) { return null; }
        @Override public <S extends MediaItem> Optional<S> findOne(Example<S> example) { return Optional.empty(); }
        @Override public <S extends MediaItem> List<S> findAll(Example<S> example) { return Collections.emptyList(); }
        @Override public <S extends MediaItem> List<S> findAll(Example<S> example, Sort sort) { return Collections.emptyList(); }
        @Override public <S extends MediaItem> Page<S> findAll(Example<S> example, Pageable pageable) { return Page.empty(); }
        @Override public <S extends MediaItem> long count(Example<S> example) { return 0; }
        @Override public <S extends MediaItem> boolean exists(Example<S> example) { return false; }
        @Override public <S extends MediaItem, R> R findBy(Example<S> example, Function<FluentQuery.FetchableFluentQuery<S>, R> queryFunction) { return null; }
        @Override public <S extends MediaItem> List<S> saveAll(Iterable<S> entities) { return Collections.emptyList(); }
        @Override public boolean existsById(UUID uuid) { return false; }
        @Override public List<MediaItem> findAll() { return new ArrayList<>(store.values()); }
        @Override public List<MediaItem> findAllById(Iterable<UUID> uuids) { return Collections.emptyList(); }
        @Override public long count() { return store.size(); }
        @Override public void deleteById(UUID uuid) {}
        @Override public void delete(MediaItem entity) {}
        @Override public void deleteAllById(Iterable<? extends UUID> uuids) {}
        @Override public void deleteAll(Iterable<? extends MediaItem> entities) {}
        @Override public void deleteAll() {}
        @Override public List<MediaItem> findAll(Sort sort) { return Collections.emptyList(); }
        @Override public Page<MediaItem> findAll(Pageable pageable) { return Page.empty(); }
    }
}
