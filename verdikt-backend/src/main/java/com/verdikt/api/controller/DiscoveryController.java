package com.verdikt.api.controller;

import com.verdikt.api.service.WeeklyPicksService;
import com.verdikt.api.service.WeeklyPicksService.WeeklyPicksResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.Duration;

/**
 * Public weekly homepage selections: editors, reading, platform-{providerId}.
 */
@RestController
@RequestMapping("/api/discovery")
public class DiscoveryController {

    /** Short cache, never past the weekly boundary, so last week's picks can't outlive it */
    private static final Duration MAX_CACHE = Duration.ofMinutes(10);

    private final WeeklyPicksService weeklyPicksService;
    private final Clock clock;

    public DiscoveryController(WeeklyPicksService weeklyPicksService, Clock clock) {
        this.weeklyPicksService = weeklyPicksService;
        this.clock = clock;
    }

    @GetMapping("/weekly/{section}")
    public ResponseEntity<WeeklyPicksResponse> weekly(@PathVariable String section) {
        WeeklyPicksResponse body = weeklyPicksService.get(section);
        if (body.picks().isEmpty()) {
            // Nothing stored yet (provider unreachable): don't let anyone cache the empty answer
            return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
        }
        Duration untilBoundary = Duration.between(clock.instant(), body.nextRefreshAt());
        Duration maxAge = untilBoundary.compareTo(MAX_CACHE) < 0 ? untilBoundary : MAX_CACHE;
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(maxAge.isNegative() ? Duration.ZERO : maxAge).cachePublic())
                .body(body);
    }
}
