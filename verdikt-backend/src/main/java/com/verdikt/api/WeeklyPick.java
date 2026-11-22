package com.verdikt.api;

import com.verdikt.api.service.WeeklyPicksService.PickItem;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * One homepage section's selection for one week (weeks start Monday 00:00 Asia/Kolkata). Everyone is served the same
 * row all week. MANUAL rows are hand-curated and never written by the app; AUTO rows are generated once per week.
 */
@Entity
@Table(name = "weekly_picks",
        uniqueConstraints = @UniqueConstraint(name = "uk_weekly_picks", columnNames = {"section", "week_start", "source"}))
public class WeeklyPick {

    public static final String AUTO = "AUTO";
    public static final String MANUAL = "MANUAL";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "VARCHAR(36)")
    private UUID id;

    @Column(name = "section", nullable = false, length = 40)
    private String section;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Column(name = "source", nullable = false, length = 10)
    private String source;

    /** What the section shows this week */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "picks_json", columnDefinition = "json", nullable = false)
    private List<PickItem> picks;

    /** Other eligible titles for this section and week; Shuffle draws from these (never persisted back) */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "pool_json", columnDefinition = "json", nullable = false)
    private List<PickItem> pool;

    @Column(name = "refreshed_at", nullable = false)
    private Instant refreshedAt;

    protected WeeklyPick() {
    }

    public WeeklyPick(String section, LocalDate weekStart, String source, List<PickItem> picks, List<PickItem> pool,
                      Instant refreshedAt) {
        this.section = section;
        this.weekStart = weekStart;
        this.source = source;
        this.picks = picks;
        this.pool = pool;
        this.refreshedAt = refreshedAt;
    }

    public String getSection() {
        return section;
    }

    public LocalDate getWeekStart() {
        return weekStart;
    }

    public String getSource() {
        return source;
    }

    public List<PickItem> getPicks() {
        return picks;
    }

    public List<PickItem> getPool() {
        return pool;
    }

    public Instant getRefreshedAt() {
        return refreshedAt;
    }
}
