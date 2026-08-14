let counter = 0;

/**
 * Small, dependency-free unique id. Uniqueness only has to hold inside one
 * device's SQLite file, so time + counter + randomness is plenty.
 */
export function createId(prefix = 'id'): string {
  counter = (counter + 1) % 100000;
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${time}${counter.toString(36)}${rand}`;
}
