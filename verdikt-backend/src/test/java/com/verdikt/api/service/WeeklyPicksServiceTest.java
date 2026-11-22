package com.verdikt.api.service;

import com.verdikt.api.MediaType;
import com.verdikt.api.WeeklyPick;
import com.verdikt.api.exception.ResourceNotFoundException;
import com.verdikt.api.repository.WeeklyPickRepository;
import com.verdikt.api.service.WeeklyPicksService.PickItem;
import com.verdikt.api.service.WeeklyPicksService.WeeklyPicksResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Weekly homepage picks against H2: boundary, stability, refresh, missed-refresh recovery, eligibility, manual rows. */
@SpringBootTest
@ActiveProfiles("test")
class WeeklyPicksServiceTest {

    @Autowired WeeklyPicksService service;
    @Autowired WeeklyPickRepository repository;
    @MockitoBean WeeklyCandidateSource candidates;
    @MockitoBean Clock clock;

    /** Tuesday 2026-11-17, 10:00 IST */
    private static final Instant TUESDAY = ist(2026, 11, 17, 10, 0);

    @BeforeEach
    void setUp() {
        repository.deleteAll();
        reset(candidates, clock);
        at(TUESDAY);
    }

    private static Instant ist(int y, int mo, int d, int h, int mi) {
        return LocalDateTime.of(y, mo, d, h, mi).atZone(WeeklyPicksService.WEEK_ZONE).toInstant();
    }

    private void at(Instant instant) {
        when(clock.instant()).thenReturn(instant);
    }

    private static List<PickItem> titles(String prefix, int n, MediaType type) {
        return IntStream.range(0, n)
                .mapToObj(i -> new PickItem(prefix + i, type, prefix + " " + i, 2020, "2020-01-01",
                        "https://image.tmdb.org/p/" + prefix + i + ".jpg", 7.5, 1000, null))
                .toList();
    }

    private static Set<String> ids(List<PickItem> items) {
        Set<String> out = new HashSet<>();
        items.forEach(p -> out.add(p.externalId()));
        return out;
    }

    @Test
    void weekStartsMondayMidnightInKolkata() {
        // Sunday 23:59 IST still belongs to the week that began Monday 16 Nov
        assertThat(WeeklyPicksService.weekStart(ist(2026, 11, 22, 23, 59))).isEqualTo(LocalDate.of(2026, 11, 16));
        // Monday 00:00 IST (still Sunday 18:30 in UTC) starts the new week
        assertThat(WeeklyPicksService.weekStart(ist(2026, 11, 23, 0, 0))).isEqualTo(LocalDate.of(2026, 11, 23));
        assertThat(WeeklyPicksService.nextBoundary(LocalDate.of(2026, 11, 16))).isEqualTo(ist(2026, 11, 23, 0, 0));
    }

    @Test
    void picksStayTheSameAllWeek() {
        when(candidates.candidates("editors")).thenReturn(titles("e", 10, MediaType.MOVIE));

        WeeklyPicksResponse first = service.get("editors");
        at(ist(2026, 11, 22, 23, 59));
        WeeklyPicksResponse later = service.get("editors");

        assertThat(first.picks()).hasSize(6);
        assertThat(later.picks()).isEqualTo(first.picks());
        assertThat(later.weekStart()).isEqualTo(LocalDate.of(2026, 11, 16));
        // Generated once, then served from storage
        verify(candidates, times(1)).candidates("editors");
    }

    @Test
    void newWeekRefreshesAndAvoidsLastWeeksPicks() {
        when(candidates.candidates("platform-8")).thenReturn(titles("n", 30, MediaType.MOVIE));
        List<PickItem> week1 = service.get("platform-8").picks();

        at(ist(2026, 11, 23, 0, 0));
        WeeklyPicksResponse week2 = service.get("platform-8");

        assertThat(week2.weekStart()).isEqualTo(LocalDate.of(2026, 11, 23));
        assertThat(week2.picks()).hasSize(12);
        // 30 eligible titles: enough to replace all 12
        assertThat(ids(week2.picks())).doesNotContainAnyElementsOf(ids(week1));
    }

    @Test
    void smallPoolRepeatsOnlyWhatItMust() {
        when(candidates.candidates("editors")).thenReturn(titles("e", 10, MediaType.MOVIE));
        Set<String> week1 = ids(service.get("editors").picks());

        at(ist(2026, 11, 24, 9, 0));
        List<PickItem> week2 = service.get("editors").picks();

        // 10 candidates, 6 shown: the 4 not shown last week come first, then 2 repeats fill the row
        assertThat(ids(week2.subList(0, 4))).doesNotContainAnyElementsOf(week1);
        assertThat(week2).hasSize(6);
        assertThat(ids(week2)).hasSize(6);
    }

    @Test
    void missedRefreshRecoversOnceUnderConcurrentRequests() throws Exception {
        when(candidates.candidates("reading")).thenReturn(titles("b", 18, MediaType.BOOK));
        // No Monday job ran; eight visitors arrive at once on Wednesday
        at(ist(2026, 11, 25, 12, 0));
        ExecutorService pool = Executors.newFixedThreadPool(8);
        List<Callable<WeeklyPicksResponse>> calls = new ArrayList<>();
        for (int i = 0; i < 8; i++) calls.add(() -> service.get("reading"));
        List<List<PickItem>> results = new ArrayList<>();
        for (Future<WeeklyPicksResponse> f : pool.invokeAll(calls)) results.add(f.get().picks());
        pool.shutdown();

        assertThat(results).allSatisfy(r -> assertThat(r).isEqualTo(results.get(0)));
        verify(candidates, times(1)).candidates("reading");
        assertThat(repository.findAll()).hasSize(1);
    }

    @Test
    void sectionsOnlyTakeEligibleTitles() {
        List<PickItem> mixed = new ArrayList<>(titles("b", 4, MediaType.BOOK));
        mixed.addAll(titles("m", 4, MediaType.MOVIE));
        mixed.add(new PickItem("noposter", MediaType.MOVIE, "No poster", 2020, null, null, 8.0, 500, null));
        when(candidates.candidates("reading")).thenReturn(mixed);
        when(candidates.candidates("platform-119")).thenReturn(mixed);

        WeeklyPicksResponse reading = service.get("reading");
        WeeklyPicksResponse prime = service.get("platform-119");

        // Books stay in the reading section; platform shelves get screen titles with posters only
        assertThat(reading.picks()).allSatisfy(p -> assertThat(p.mediaType()).isEqualTo(MediaType.BOOK));
        assertThat(reading.pool()).allSatisfy(p -> assertThat(p.mediaType()).isEqualTo(MediaType.BOOK));
        assertThat(prime.picks()).extracting(PickItem::externalId).containsExactly("m0", "m1", "m2", "m3");
        assertThatThrownBy(() -> service.get("platform-999")).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.get("anything")).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void manualPicksWinAndAreNeverOverwritten() {
        LocalDate week = LocalDate.of(2026, 11, 16);
        List<PickItem> curated = titles("curated", 6, MediaType.MOVIE);
        repository.save(new WeeklyPick("editors", week, WeeklyPick.MANUAL, curated, List.of(), TUESDAY));
        when(candidates.candidates("editors")).thenReturn(titles("e", 10, MediaType.MOVIE));

        service.refreshAll();
        WeeklyPicksResponse served = service.get("editors");

        assertThat(served.source()).isEqualTo(WeeklyPick.MANUAL);
        assertThat(served.picks()).isEqualTo(curated);
        // The automatic selection was refreshed alongside, in its own row
        assertThat(repository.findBySectionAndWeekStartAndSource("editors", week, WeeklyPick.AUTO)).isPresent();
        assertThat(repository.findBySectionAndWeekStartAndSource("editors", week, WeeklyPick.MANUAL).orElseThrow().getPicks())
                .isEqualTo(curated);
    }

    @Test
    void providerOutageStoresNothingAndRetries() {
        when(candidates.candidates(anyString())).thenReturn(List.of());
        assertThat(service.get("platform-8").picks()).isEmpty();
        assertThat(repository.findAll()).isEmpty();

        when(candidates.candidates("platform-8")).thenReturn(titles("n", 20, MediaType.SERIES));
        assertThat(service.get("platform-8").picks()).hasSize(12);
        assertThat(repository.findAll()).hasSize(1);
    }
}
