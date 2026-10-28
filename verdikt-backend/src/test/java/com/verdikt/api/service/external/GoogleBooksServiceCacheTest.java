package com.verdikt.api.service.external;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Google Books caps each key at 1,000 queries a day, so repeated searches must be served from memory
 * and a quota failure must not be cached (or the shelf would stay empty after the quota resets).
 */
class GoogleBooksServiceCacheTest {

    private static final String ONE_BOOK = """
            {"items":[{"id":"abc","volumeInfo":{"title":"Dune","publishedDate":"1965"}}]}""";

    private GoogleBooksService serviceAnswering(AtomicInteger calls, HttpStatus... statuses) {
        WebClient client = WebClient.builder()
                .exchangeFunction(request -> {
                    int n = calls.getAndIncrement();
                    HttpStatus status = statuses[Math.min(n, statuses.length - 1)];
                    return Mono.just(ClientResponse.create(status)
                            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                            .body(status.is2xxSuccessful() ? ONE_BOOK : "{\"error\":{}}")
                            .build());
                })
                .build();
        GoogleBooksService service = new GoogleBooksService(client);
        ReflectionTestUtils.setField(service, "apiKey", "");
        ReflectionTestUtils.setField(service, "baseUrl", "https://books.test/v1");
        return service;
    }

    @Test
    void repeatedSearchIsServedFromCache() {
        AtomicInteger calls = new AtomicInteger();
        GoogleBooksService service = serviceAnswering(calls, HttpStatus.OK);

        assertThat(service.searchBooks("Dune Frank Herbert")).hasSize(1);
        assertThat(service.searchBooks("Dune Frank Herbert")).hasSize(1);
        assertThat(calls.get()).isEqualTo(1);

        service.searchBooks("Atomic Habits");
        assertThat(calls.get()).isEqualTo(2);
    }

    @Test
    void quotaErrorIsNotCached() {
        AtomicInteger calls = new AtomicInteger();
        GoogleBooksService service = serviceAnswering(calls, HttpStatus.TOO_MANY_REQUESTS, HttpStatus.OK);

        assertThat(service.searchBooks("Dune")).isEmpty();
        assertThat(service.searchBooks("Dune")).hasSize(1);
        assertThat(calls.get()).isEqualTo(2);
    }
}
