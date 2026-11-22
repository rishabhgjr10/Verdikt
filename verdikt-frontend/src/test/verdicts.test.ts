import { describe, expect, it } from 'vitest';
import { topVerdict } from '@/components/reviews/verdicts';
import { cardVerdict } from '@/lib/tmdb';

describe('topVerdict (same rule as the backend ConsensusService)', () => {
  it('picks the most common verdict', () => {
    expect(topVerdict(['PERFECTION', 'PERFECTION', 'SKIP_IT'])).toBe('PERFECTION');
  });
  it('breaks a tie toward the more cautious verdict', () => {
    expect(topVerdict(['PERFECTION', 'TIMEPASS'])).toBe('TIMEPASS');
    expect(topVerdict(['GO_FOR_IT', 'SKIP_IT', 'PERFECTION'])).toBe('SKIP_IT');
  });
  it('has no verdict without reviews', () => {
    expect(topVerdict([])).toBeNull();
  });
});

describe('cardVerdict', () => {
  it("prefers the members' consensus over the audience score", () => {
    expect(cardVerdict({ consensus: 'SKIP_IT', voteAverage: 9, voteCount: 5000, releaseYear: 2000 })).toBe('SKIP_IT');
    expect(cardVerdict({ voteAverage: 9, voteCount: 5000, releaseYear: 2000 })).toBe('PERFECTION');
  });
});
