// Seeded random (mulberry32): the same seed builds the same city, so screenshots
// and ?shot= scenes are repeatable. One stream per system keeps layout stable even
// when a system adds or drops a draw.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random float in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** A random integer in [min, max] inclusive. */
export function intRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One element of `items`, uniformly. */
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}
