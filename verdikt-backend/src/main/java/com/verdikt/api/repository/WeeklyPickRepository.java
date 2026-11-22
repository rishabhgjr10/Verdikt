package com.verdikt.api.repository;

import com.verdikt.api.WeeklyPick;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WeeklyPickRepository extends JpaRepository<WeeklyPick, UUID> {

    Optional<WeeklyPick> findBySectionAndWeekStartAndSource(String section, LocalDate weekStart, String source);
}
