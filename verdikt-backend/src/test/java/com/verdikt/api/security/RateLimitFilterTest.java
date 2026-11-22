package com.verdikt.api.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitFilterTest {

    private static Clock at(long epochSecond) {
        return Clock.fixed(Instant.ofEpochSecond(epochSecond), ZoneOffset.UTC);
    }

    @Test
    void routesFallIntoTheRightGroups() {
        assertThat(RateLimitFilter.limitFor("POST", "/api/auth/login")).isEqualTo(RateLimitFilter.AUTH);
        assertThat(RateLimitFilter.limitFor("PUT", "/api/me/avatar")).isEqualTo(RateLimitFilter.UPLOAD);
        assertThat(RateLimitFilter.limitFor("GET", "/api/media/search")).isEqualTo(RateLimitFilter.PROVIDER);
        assertThat(RateLimitFilter.limitFor("GET", "/api/media/external/MOVIE/389")).isEqualTo(RateLimitFilter.PROVIDER);
        assertThat(RateLimitFilter.limitFor("POST", "/api/reviews")).isEqualTo(RateLimitFilter.WRITE);
        assertThat(RateLimitFilter.limitFor("GET", "/api/reviews/media/x")).isNull();
        assertThat(RateLimitFilter.limitFor("OPTIONS", "/api/reviews")).isNull();
    }

    @Test
    void eleventhLoginInAMinuteIsRejectedThenTheWindowResets() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(at(1_000));
        for (int i = 0; i < 10; i++) assertThat(filter.allow("1.2.3.4", RateLimitFilter.AUTH)).isTrue();
        assertThat(filter.allow("1.2.3.4", RateLimitFilter.AUTH)).isFalse();
        // Another client is unaffected
        assertThat(filter.allow("5.6.7.8", RateLimitFilter.AUTH)).isTrue();

        RateLimitFilter later = new RateLimitFilter(at(1_061));
        assertThat(later.allow("1.2.3.4", RateLimitFilter.AUTH)).isTrue();
    }

    @Test
    void overTheLimitAnswers429WithRetryAfter() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(at(2_000));
        MockHttpServletResponse last = null;
        for (int i = 0; i < 11; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/auth/login");
            req.addHeader("X-Forwarded-For", "9.9.9.9, 10.0.0.1");
            last = new MockHttpServletResponse();
            filter.doFilter(req, last, new MockFilterChain());
        }
        assertThat(last.getStatus()).isEqualTo(429);
        assertThat(last.getHeader("Retry-After")).isEqualTo("60");
    }

    @Test
    void onlyTheProxyAppendedForwardedAddressIsTrusted() {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("X-Forwarded-For", "6.6.6.6, 203.0.113.7");
        assertThat(RateLimitFilter.clientIp(req)).isEqualTo("203.0.113.7");
    }
}
