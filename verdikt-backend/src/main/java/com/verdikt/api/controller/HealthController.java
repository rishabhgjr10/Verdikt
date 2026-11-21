package com.verdikt.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * Lightweight health-check endpoint.
 * Used by UptimeRobot / Cron-Job.org to ping Render every 10–12 minutes
 * and prevent the free-tier instance from cold-starting.
 *
 * Endpoints: GET /health (uptime pinger) and GET /api/health
 * Returns:  200 OK  { "status": "UP", "timestamp": "<ISO-8601>" }
 */
@RestController
public class HealthController {

    /** Uptime pinger (cron-job.org): public, touches no database or external API. */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> ping() {
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "verdikt-api",
                "timestamp", Instant.now().toString()
        ));
    }
}
