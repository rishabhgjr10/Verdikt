package com.verdikt.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * Lightweight health-check endpoint.
 * Used by UptimeRobot / Cron-Job.org to ping Render every 10–12 minutes
 * and prevent the free-tier instance from cold-starting.
 *
 * Endpoint: GET /api/health
 * Returns:  200 OK  { "status": "UP", "timestamp": "<ISO-8601>" }
 */
@RestController
@RequestMapping("/api")
public class HealthController {

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "verdikt-api",
                "timestamp", Instant.now().toString()
        ));
    }
}
