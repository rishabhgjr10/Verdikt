/**
 * Shuffle for a homepage shelf: each click shows titles that haven't been on screen yet in this cycle, so repeated
 * clicks walk through the whole pool instead of flipping between two sets. Once everything has been shown, a new
 * cycle starts (still avoiding what is on screen right now).
 */
export function nextShuffle<T>(
  pool: T[],
  keyOf: (item: T) => string,
  visible: T[],
  seen: ReadonlySet<string>,
  size: number,
  random: () => number = Math.random
): { items: T[]; seen: Set<string> } {
  const unique = [...new Map(pool.map((item) => [keyOf(item), item])).values()];
  const onScreen = new Set(visible.map(keyOf));
  const shuffled = (list: T[]) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  let cycle = new Set([...seen, ...onScreen]);
  let fresh = unique.filter((x) => !cycle.has(keyOf(x)));
  if (fresh.length === 0) {
    cycle = new Set(onScreen);
    fresh = unique.filter((x) => !onScreen.has(keyOf(x)));
  }

  const picked = shuffled(fresh).slice(0, size);
  // Too few new titles: top up with ones shown earlier, and only fall back to what's on screen when the pool is tiny
  if (picked.length < size) {
    const used = new Set(picked.map(keyOf));
    const earlier = shuffled(unique.filter((x) => !used.has(keyOf(x)) && !onScreen.has(keyOf(x))));
    picked.push(...earlier.slice(0, size - picked.length));
    const now = new Set(picked.map(keyOf));
    picked.push(...shuffled(unique.filter((x) => !now.has(keyOf(x)))).slice(0, size - picked.length));
  }

  for (const item of picked) cycle.add(keyOf(item));
  return { items: picked, seen: cycle };
}
