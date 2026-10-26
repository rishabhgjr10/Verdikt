package com.verdikt.api.service.external;

import com.fasterxml.jackson.databind.JsonNode;
import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriBuilder;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

import java.net.URI;
import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;

/**
 * Small helper for keyed third-party JSON APIs used by ratings/reviews.
 * Every call has an 8s timeout and failures are logged with the provider name and
 * exception type only — never the request URI, which may contain an API key.
 */
public final class ExternalHttp {

    private static final Logger log = LoggerFactory.getLogger(ExternalHttp.class);
    public static final Duration TIMEOUT = Duration.ofSeconds(8);

    /** Body plus status; the body is kept on 4xx because some APIs (OMDb) explain limits there. */
    public record JsonResponse(int status, JsonNode body) {
    }

    private ExternalHttp() {
    }

    public static WebClient client(String baseUrl) {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, (int) TIMEOUT.toMillis())
                .responseTimeout(TIMEOUT)
                .doOnConnected(conn -> conn
                        .addHandlerLast(new ReadTimeoutHandler(TIMEOUT.toSeconds(), TimeUnit.SECONDS))
                        .addHandlerLast(new WriteTimeoutHandler(TIMEOUT.toSeconds(), TimeUnit.SECONDS)));
        return WebClient.builder()
                .baseUrl(baseUrl)
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .defaultHeader(HttpHeaders.ACCEPT, "application/json")
                .defaultHeader(HttpHeaders.USER_AGENT, "Verdikt/1.0")
                .codecs(c -> c.defaultCodecs().maxInMemorySize(4 * 1024 * 1024))
                .build();
    }

    /** GET returning the JSON body and status, or empty on network error/timeout. */
    public static Optional<JsonResponse> get(WebClient client, String provider, Function<UriBuilder, URI> uri) {
        return exchange(provider, client.get().uri(uri)
                .exchangeToMono(resp -> resp.bodyToMono(JsonNode.class)
                        .map(body -> new JsonResponse(resp.statusCode().value(), body))
                        .defaultIfEmpty(new JsonResponse(resp.statusCode().value(), null))));
    }

    /** POST of a JSON body (used for GraphQL). */
    public static Optional<JsonResponse> postJson(WebClient client, String provider, Object body) {
        return exchange(provider, client.post().bodyValue(body)
                .exchangeToMono(resp -> resp.bodyToMono(JsonNode.class)
                        .map(json -> new JsonResponse(resp.statusCode().value(), json))
                        .defaultIfEmpty(new JsonResponse(resp.statusCode().value(), null))));
    }

    private static Optional<JsonResponse> exchange(String provider, Mono<JsonResponse> call) {
        try {
            return Optional.ofNullable(call.timeout(TIMEOUT).block(TIMEOUT.plusSeconds(1)));
        } catch (Exception e) {
            Throwable root = e;
            while (root.getCause() != null && root.getCause() != root) {
                root = root.getCause();
            }
            log.warn("External provider {} unavailable: {}", provider, root.getClass().getSimpleName());
            return Optional.empty();
        }
    }
}
