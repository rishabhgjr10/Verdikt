package com.verdikt.api.service;

import com.verdikt.api.MediaType;
import com.verdikt.api.WeeklyPick;
import com.verdikt.api.dto.MediaItemDTO;
import com.verdikt.api.exception.ResourceNotFoundException;
import com.verdikt.api.repository.WeeklyPickRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
 * Weekly homepage selections ("Editor's Pick Of The Week", "Worth Your Time To Read", the platform shelves).
 * A week runs from Monday 00:00 Asia/Kolkata. Each section's selection is generated once per week, stored, and served
 * to everyone until the next boundary. The Monday job pre-generates; if it was missed (the free host was asleep), the
 * first request of the week generates instead, once, under a per-section lock backed by a unique row key.
 */
@Service
public class WeeklyPicksService {

    private static final Logger log = LoggerFactory.getLogger(WeeklyPicksService.class);

    public static final ZoneId WEEK_ZONE = ZoneId.of("Asia/Kolkata");
    /** How many extra eligible titles are kept for Shuffle */
    private static final int POOL_CAP = 60;

    /** A title as the homepage cards need it; only provider data, never invented ratings or availability */
    public record PickItem(String externalId, MediaType mediaType, String title, Integer releaseYear, String releaseDate,
                           String coverImage, Double voteAverage, Integer voteCount, String href) {

        public static PickItem of(MediaItemDTO d) {
            return new PickItem(d.getExternalId(), d.getMediaType(), d.getTitle(), d.getReleaseYear(),
                    d.getReleaseDate() != null ? d.getReleaseDate().toString() : null, d.getCoverImage(),
                    d.getVoteAverage(), d.getVoteCount(), null);
        }

        /** Series and anime share TMDB's TV id space */
        String key() {
            String ns = mediaType == MediaType.SERIES || mediaType == MediaType.ANIME ? "TV" : String.valueOf(mediaType);
            return ns + ":" + externalId;
        }
    }

    public record WeeklyPicksResponse(String section, LocalDate weekStart, Instant refreshedAt, Instant nextRefreshAt,
                                      String source, List<PickItem> picks, List<PickItem> pool) {
    }

    /** How a section is filled: size, which titles may appear, and whether the order is popularity or a weekly draw */
    record SectionRule(int count, Predicate<PickItem> eligible, boolean byPopularity) {
    }

    private static final Predicate<PickItem> SCREEN = p -> p.coverImage() != null
            && (p.mediaType() == MediaType.MOVIE || p.mediaType() == MediaType.SERIES || p.mediaType() == MediaType.ANIME);
    private static final Predicate<PickItem> BOOK = p -> p.coverImage() != null && p.mediaType() == MediaType.BOOK;

    private final WeeklyPickRepository repository;
    private final WeeklyCandidateSource candidates;
    private final Clock clock;
    private final ConcurrentHashMap<String, Object> locks = new ConcurrentHashMap<>();

    public WeeklyPicksService(WeeklyPickRepository repository, WeeklyCandidateSource candidates, Clock clock) {
        this.repository = repository;
        this.candidates = candidates;
        this.clock = clock;
    }

    /** Monday 00:00 Asia/Kolkata on or before the instant */
    public static LocalDate weekStart(Instant instant) {
        return instant.atZone(WEEK_ZONE).toLocalDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    public static Instant nextBoundary(LocalDate weekStart) {
        return weekStart.plusWeeks(1).atStartOfDay(WEEK_ZONE).toInstant();
    }

    static SectionRule rule(String section) {
        if ("editors".equals(section)) {
            return new SectionRule(6, SCREEN, false);
        }
        if ("reading".equals(section)) {
            return new SectionRule(6, BOOK, false);
        }
        if (section != null && section.startsWith("platform-")
                && WeeklyCandidateSource.PLATFORM_PROVIDERS.containsKey(section.substring("platform-".length()))) {
            return new SectionRule(12, SCREEN, true);
        }
        return null;
    }

    public static List<String> sections() {
        List<String> all = new ArrayList<>(List.of("editors", "reading"));
        WeeklyCandidateSource.PLATFORM_PROVIDERS.keySet().forEach(id -> all.add("platform-" + id));
        return all;
    }

    /** This week's selection: a hand-curated row wins; otherwise the generated one, generating it if missing */
    public WeeklyPicksResponse get(String section) {
        SectionRule rule = rule(section);
        if (rule == null) {
            throw new ResourceNotFoundException("Unknown section.");
        }
        LocalDate week = weekStart(clock.instant());
        Optional<WeeklyPick> manual = repository.findBySectionAndWeekStartAndSource(section, week, WeeklyPick.MANUAL);
        if (manual.isPresent()) {
            return toResponse(manual.get());
        }
        return ensureAuto(section, rule, week)
                .map(this::toResponse)
                // Provider down: serve nothing now (nothing stored), so the next request retries
                .orElseGet(() -> new WeeklyPicksResponse(section, week, null, nextBoundary(week), WeeklyPick.AUTO,
                        List.of(), List.of()));
    }

    /** Monday 00:00 IST: pre-generate every section. Missed runs are covered by get() on the next request. */
    @Scheduled(cron = "0 0 0 * * MON", zone = "Asia/Kolkata")
    public void refreshAll() {
        LocalDate week = weekStart(clock.instant());
        for (String section : sections()) {
            try {
                // Generated even when a manual row exists, so the automatic selection stays current separately
                ensureAuto(section, rule(section), week);
            } catch (Exception e) {
                log.warn("Weekly refresh failed for {}: {}", section, e.getMessage());
            }
        }
    }

    private Optional<WeeklyPick> ensureAuto(String section, SectionRule rule, LocalDate week) {
        Optional<WeeklyPick> existing = repository.findBySectionAndWeekStartAndSource(section, week, WeeklyPick.AUTO);
        if (existing.isPresent()) {
            return existing;
        }
        Object lock = locks.computeIfAbsent(section, k -> new Object());
        synchronized (lock) {
            existing = repository.findBySectionAndWeekStartAndSource(section, week, WeeklyPick.AUTO);
            if (existing.isPresent()) {
                return existing;
            }
            List<PickItem> eligible = candidates.candidates(section).stream().filter(rule.eligible()).toList();
            if (eligible.isEmpty()) {
                log.warn("No eligible titles for {} this week; will retry on the next request", section);
                return Optional.empty();
            }
            Set<String> previous = previousWeekKeys(section, week);
            // Seeded per section and week: a regenerated row (e.g. after a lost insert) draws the same titles
            Random random = rule.byPopularity() ? null : new Random((section + week).hashCode());
            Selection selection = select(eligible, previous, rule.count(), random);
            WeeklyPick row = new WeeklyPick(section, week, WeeklyPick.AUTO, selection.picks(), selection.pool(),
                    clock.instant());
            try {
                return Optional.of(repository.saveAndFlush(row));
            } catch (DataIntegrityViolationException raced) {
                // Another instance stored this week's row first; serve theirs
                return repository.findBySectionAndWeekStartAndSource(section, week, WeeklyPick.AUTO);
            }
        }
    }

    /** What the section showed last week (the manual row if there was one), to avoid repeating it */
    private Set<String> previousWeekKeys(String section, LocalDate week) {
        LocalDate prev = week.minusWeeks(1);
        return repository.findBySectionAndWeekStartAndSource(section, prev, WeeklyPick.MANUAL)
                .or(() -> repository.findBySectionAndWeekStartAndSource(section, prev, WeeklyPick.AUTO))
                .map(p -> p.getPicks().stream().map(PickItem::key).collect(Collectors.toSet()))
                .orElse(Collections.emptySet());
    }

    record Selection(List<PickItem> picks, List<PickItem> pool) {
    }

    /**
     * Picks `count` titles, preferring ones not shown last week; the rest of the eligible titles become the Shuffle pool.
     * random == null keeps the candidates' order (popularity); otherwise the order is a weekly draw.
     */
    static Selection select(List<PickItem> eligible, Set<String> previous, int count, Random random) {
        Map<String, PickItem> unique = new LinkedHashMap<>();
        eligible.forEach(p -> unique.putIfAbsent(p.key(), p));
        List<PickItem> ordered = new ArrayList<>(unique.values());
        if (random != null) {
            Collections.shuffle(ordered, random);
        }
        List<PickItem> fresh = ordered.stream().filter(p -> !previous.contains(p.key())).toList();
        List<PickItem> repeats = ordered.stream().filter(p -> previous.contains(p.key())).toList();
        List<PickItem> all = new ArrayList<>(fresh);
        all.addAll(repeats);
        int n = Math.min(count, all.size());
        return new Selection(List.copyOf(all.subList(0, n)),
                List.copyOf(all.subList(n, Math.min(all.size(), n + POOL_CAP))));
    }

    private WeeklyPicksResponse toResponse(WeeklyPick p) {
        return new WeeklyPicksResponse(p.getSection(), p.getWeekStart(), p.getRefreshedAt(), nextBoundary(p.getWeekStart()),
                p.getSource(), p.getPicks(), p.getPool() != null ? p.getPool() : List.of());
    }
}
