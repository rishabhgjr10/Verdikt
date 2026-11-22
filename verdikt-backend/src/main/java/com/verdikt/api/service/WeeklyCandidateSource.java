package com.verdikt.api.service;

import com.verdikt.api.MediaType;
import com.verdikt.api.dto.MediaItemDTO;
import com.verdikt.api.service.WeeklyPicksService.PickItem;
import com.verdikt.api.service.external.TmdbService;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * The eligible titles each weekly section may draw from. Editor's picks and the reading list are hand-curated here
 * (the same lists the homepage used before); platform shelves come from TMDB's watch-provider data for India.
 */
@Component
public class WeeklyCandidateSource {

    public static final String REGION = "IN";

    /**
     * Homepage platform id -> TMDB provider ids queried. JioHotstar is provider 2336 since the merger (the old Hotstar
     * 122 / JioCinema 220 ids only cover a few leftovers); Prime includes its ad-supported tier (2100).
     */
    public static final Map<String, String> PLATFORM_PROVIDERS = Map.of(
            "8", "8",
            "122", "2336|122|220",
            "119", "119|2100",
            "283", "283",
            "237", "237",
            "350", "350");

    /** Pages of popular titles per kind; 3 pages of movies + 3 of series gives ~100 eligible titles before filtering */
    private static final int PLATFORM_PAGES = 3;

    private record Seed(String title, boolean tv, int year, MediaType type) {
    }

    /** Editor's Pick: cult classics and masterpieces, 1950s–2020s; Indian and global/anime alternate */
    private static final List<Seed> EDITORS_PICKS = List.of(
            new Seed("Tumbbad", false, 2018, MediaType.MOVIE),
            new Seed("12 Angry Men", false, 1957, MediaType.MOVIE),
            new Seed("Gangs of Wasseypur", false, 2012, MediaType.MOVIE),
            new Seed("Great Teacher Onizuka", true, 1999, MediaType.ANIME),
            new Seed("Satya", false, 1998, MediaType.MOVIE),
            new Seed("Witness for the Prosecution", false, 1957, MediaType.MOVIE),
            new Seed("Bhoothakaalam", false, 2022, MediaType.MOVIE),
            new Seed("The Good Place", true, 2016, MediaType.SERIES),
            new Seed("The Substance", false, 2024, MediaType.MOVIE),
            new Seed("Pather Panchali", false, 1955, MediaType.MOVIE));

    /** "Worth Your Time To Read" (kept in step with CURATED_WORTH_READING in verdikt-frontend/src/lib/discovery.ts) */
    private static final List<PickItem> WORTH_READING = List.of(
            isbn("9780812979657", "The God of Small Things", 1997),
            google("kotPYEqx7kMC", "1984", 1949),
            google("agMWBAAAQBAJ", "Sacred Games", 2006),
            google("B1hSG45JCX4C", "Dune", 1965),
            isbn("9788185986173", "Malgudi Days", 1943),
            isbn("9780140449136", "Crime and Punishment", 1866),
            isbn("9780143419983", "A Suitable Boy", 1993),
            isbn("9780593135204", "Project Hail Mary", 2021),
            isbn("9780812976533", "Midnight's Children", 1981),
            isbn("9780061120084", "To Kill a Mockingbird", 1960),
            isbn("9780062315007", "The Alchemist", 1988),
            isbn("9781416562603", "The White Tiger", 2008),
            isbn("9780062316097", "Sapiens", 2011),
            isbn("9789380658742", "The Immortals of Meluha", 2010),
            isbn("9780735211292", "Atomic Habits", 2018),
            isbn("9780143065883", "Train to Pakistan", 1956),
            isbn("9780593321201", "Tomorrow, and Tomorrow, and Tomorrow", 2022),
            isbn("9781400096206", "The Palace of Illusions", 2008));

    private final TmdbService tmdb;

    public WeeklyCandidateSource(TmdbService tmdb) {
        this.tmdb = tmdb;
    }

    public List<PickItem> candidates(String section) {
        if ("editors".equals(section)) {
            return editorsPicks();
        }
        if ("reading".equals(section)) {
            return WORTH_READING;
        }
        String providers = PLATFORM_PROVIDERS.get(section.substring("platform-".length()));
        return platformTitles(providers);
    }

    private List<PickItem> editorsPicks() {
        List<PickItem> out = new ArrayList<>();
        for (Seed s : EDITORS_PICKS) {
            List<MediaItemDTO> results = s.tv() ? tmdb.searchSeries(s.title()) : tmdb.searchMovies(s.title());
            // Same year (±1) with a poster; an exact title match wins (search results are popularity-ordered)
            List<MediaItemDTO> sameYear = results.stream()
                    .filter(r -> r.getCoverImage() != null && r.getReleaseYear() != null
                            && Math.abs(r.getReleaseYear() - s.year()) <= 1)
                    .toList();
            sameYear.stream()
                    .filter(r -> s.title().equalsIgnoreCase(r.getTitle()))
                    .findFirst()
                    .or(() -> sameYear.stream().findFirst())
                    .map(r -> withType(PickItem.of(r), s.type()))
                    .ifPresent(out::add);
        }
        return out;
    }

    /** Movies and series interleaved, each in TMDB popularity order */
    private List<PickItem> platformTitles(String providers) {
        List<PickItem> movies = new ArrayList<>();
        List<PickItem> series = new ArrayList<>();
        for (int page = 1; page <= PLATFORM_PAGES; page++) {
            tmdb.discoverByProviders(false, providers, REGION, page).forEach(d -> movies.add(PickItem.of(d)));
            tmdb.discoverByProviders(true, providers, REGION, page).forEach(d -> series.add(PickItem.of(d)));
        }
        List<PickItem> out = new ArrayList<>();
        for (int i = 0; i < Math.max(movies.size(), series.size()); i++) {
            if (i < movies.size()) out.add(movies.get(i));
            if (i < series.size()) out.add(series.get(i));
        }
        return out;
    }

    private static PickItem withType(PickItem p, MediaType type) {
        return new PickItem(p.externalId(), type, p.title(), p.releaseYear(), p.releaseDate(), p.coverImage(),
                p.voteAverage(), p.voteCount(), p.href());
    }

    private static PickItem google(String volumeId, String title, int year) {
        return new PickItem(volumeId, MediaType.BOOK, title, year, null,
                "https://books.google.com/books/content?id=" + volumeId + "&printsec=frontcover&img=1&zoom=1",
                null, null, null);
    }

    /** No known Google volume id: Open Library cover by ISBN, and the card links to a book search */
    private static PickItem isbn(String isbn, String title, int year) {
        return new PickItem("isbn-" + isbn, MediaType.BOOK, title, year, null,
                "https://covers.openlibrary.org/b/isbn/" + isbn + "-L.jpg", null, null,
                "/search?q=" + URLEncoder.encode(title, StandardCharsets.UTF_8).replace("+", "%20") + "&type=BOOK");
    }

}
