import { describe, expect, it } from 'vitest';
import { nextShuffle } from '@/lib/shuffle';

const pool = Array.from({ length: 24 }, (_, i) => `t${i}`);
const key = (s: string) => s;

describe('nextShuffle', () => {
  it('replaces every title on screen when the pool allows it', () => {
    const visible = pool.slice(0, 12);
    const { items } = nextShuffle(pool, key, visible, new Set(), 12);
    expect(items).toHaveLength(12);
    expect(items.filter((x) => visible.includes(x))).toEqual([]);
  });

  it('walks the whole pool before repeating, with no duplicates', () => {
    const big = Array.from({ length: 30 }, (_, i) => `b${i}`);
    let visible = big.slice(0, 6);
    let seen = new Set<string>();
    const shown = new Set(visible);
    for (let click = 0; click < 4; click++) {
      const next = nextShuffle(big, key, visible, seen, 6);
      expect(new Set(next.items).size).toBe(6);
      for (const x of next.items) expect(shown.has(x)).toBe(false);
      next.items.forEach((x) => shown.add(x));
      visible = next.items;
      seen = next.seen;
    }
    expect(shown.size).toBe(30);
  });

  it('starts a new cycle once everything was shown, still avoiding the current set', () => {
    const small = ['a', 'b', 'c', 'd'];
    const first = nextShuffle(small, key, ['a', 'b'], new Set(), 2);
    expect(first.items.sort()).toEqual(['c', 'd']);
    const second = nextShuffle(small, key, first.items, first.seen, 2);
    expect(second.items.sort()).toEqual(['a', 'b']);
  });

  it('shows what exists without duplicates when the pool is smaller than the row', () => {
    const { items } = nextShuffle(['a', 'b', 'c'], key, ['a', 'b'], new Set(), 6);
    expect(new Set(items).size).toBe(items.length);
    expect(items.sort()).toEqual(['a', 'b', 'c']);
  });
});
