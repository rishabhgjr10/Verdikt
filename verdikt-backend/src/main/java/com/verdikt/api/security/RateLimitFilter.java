package com.verdikt.api.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-client request limits, by route group: sign-in and sign-up, photo uploads, provider-backed reads (search and
 * title imports, which spend third-party quotas), and every other write. Over the limit, the client gets a 429 with
 * Retry-After. Runs after the security chain, so the 429 still carries CORS headers the browser can read.
 * shortcut: counters live in this instance's memory, so N instances allow N times the limit; move to Redis when the
 * API runs on more than one instance.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    /** Requests allowed per window for each route group */
    public record Limit(String group, int requests, long windowSeconds) {
    }

    static final Limit AUTH = new Limit("auth", 10, 60);
    static final Limit UPLOAD = new Limit("upload", 10, 3600);
    static final Limit PROVIDER = new Limit("provider", 60, 60);
    static final Limit WRITE = new Limit("write", 60, 60);

    private record Window(long startEpochSecond, int count) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    public RateLimitFilter(Clock clock) {
        this.clock = clock;
    }

    static Limit limitFor(String method, String path) {
        if (path.startsWith("/api/auth/") && "POST".equals(method)) return AUTH;
        if (path.equals("/api/me/avatar") && "PUT".equals(method)) return UPLOAD;
        if ("GET".equals(method) && (path.equals("/api/media/search") || path.startsWith("/api/media/external/"))) {
            return PROVIDER;
        }
        if (path.startsWith("/api/") && !"GET".equals(method) && !"HEAD".equals(method) && !"OPTIONS".equals(method)) {
            return WRITE;
        }
        return null;
    }

    /** True when this request still fits its group's budget; counts it either way */
    boolean allow(String clientKey, Limit limit) {
        long now = Instant.now(clock).getEpochSecond();
        String key = limit.group() + "|" + clientKey;
        Window w = windows.compute(key, (k, cur) -> cur == null || now - cur.startEpochSecond() >= limit.windowSeconds()
                ? new Window(now, 1)
                : new Window(cur.startEpochSecond(), cur.count() + 1));
        if (windows.size() > 50_000) {
            // Bounded memory: drop finished windows once many clients have been seen
            windows.entrySet().removeIf(e -> now - e.getValue().startEpochSecond() >= 3600);
        }
        return w.count() <= limit.requests();
    }

    long retryAfterSeconds(String clientKey, Limit limit) {
        Window w = windows.get(limit.group() + "|" + clientKey);
        long now = Instant.now(clock).getEpochSecond();
        return w == null ? 1 : Math.max(1, w.startEpochSecond() + limit.windowSeconds() - now);
    }

    /**
     * The connecting client. Behind Render's proxy that is the LAST X-Forwarded-For entry (the one the proxy appended);
     * earlier entries are whatever the client sent, so trusting them would let anyone pick a fresh IP per request.
     */
    static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String[] hops = forwarded.split(",");
            return hops[hops.length - 1].trim();
        }
        return request.getRemoteAddr();
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        Limit limit = limitFor(request.getMethod(), request.getRequestURI());
        if (limit != null) {
            String client = clientIp(request);
            if (!allow(client, limit)) {
                response.setStatus(429);
                response.setHeader("Retry-After", String.valueOf(retryAfterSeconds(client, limit)));
                response.setContentType("application/json");
                response.getWriter().write("{\"status\":429,\"error\":\"Too Many Requests\",\"message\":\"Too many requests. Please wait a moment and try again.\"}");
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
