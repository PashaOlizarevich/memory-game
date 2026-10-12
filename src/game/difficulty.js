export const DEFAULT_DIFFICULTY_ID = 'easy';

export const difficulties = Object.freeze([
  { id: 'easy', label: 'Лёгкий', pairCount: 8, columns: 4, rows: 4 },
  { id: 'medium', label: 'Средний', pairCount: 12, columns: 6, rows: 4 },
  { id: 'hard', label: 'Сложный', pairCount: 16, columns: 8, rows: 4 },
  { id: 'expert', label: 'Эксперт', pairCount: 20, columns: 8, rows: 5 },
].map((difficulty) => Object.freeze(difficulty)));

export function getDifficulty(id) {
  const difficulty = difficulties.find((entry) => entry.id === id);
  if (!difficulty) throw new RangeError('Unknown difficulty: ' + id);
  return difficulty;
}
