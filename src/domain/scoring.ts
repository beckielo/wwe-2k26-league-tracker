export function calculatePoints(wins: number, draws: number): number {
  if (!Number.isInteger(wins) || !Number.isInteger(draws) || wins < 0 || draws < 0) {
    throw new Error("Wins and draws must be non-negative integers.");
  }
  return wins * 3 + draws;
}
