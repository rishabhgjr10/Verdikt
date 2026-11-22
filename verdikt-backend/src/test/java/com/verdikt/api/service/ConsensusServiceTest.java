package com.verdikt.api.service;

import com.verdikt.api.Verdict;
import org.junit.jupiter.api.Test;

import java.util.EnumMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ConsensusServiceTest {

    private static Map<Verdict, Long> counts(Object... pairs) {
        Map<Verdict, Long> m = new EnumMap<>(Verdict.class);
        for (int i = 0; i < pairs.length; i += 2) m.put((Verdict) pairs[i], ((Number) pairs[i + 1]).longValue());
        return m;
    }

    @Test
    void mostCommonVerdictWins() {
        assertThat(ConsensusService.top(counts(Verdict.PERFECTION, 3, Verdict.SKIP_IT, 1))).isEqualTo(Verdict.PERFECTION);
    }

    @Test
    void aTieGoesToTheMoreCautiousVerdict() {
        assertThat(ConsensusService.top(counts(Verdict.PERFECTION, 2, Verdict.TIMEPASS, 2))).isEqualTo(Verdict.TIMEPASS);
        assertThat(ConsensusService.top(counts(Verdict.GO_FOR_IT, 1, Verdict.SKIP_IT, 1, Verdict.PERFECTION, 1))).isEqualTo(Verdict.SKIP_IT);
    }

    @Test
    void noReviewsMeansNoConsensus() {
        assertThat(ConsensusService.top(counts())).isNull();
    }
}
