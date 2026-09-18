export interface GameStats {
  level: number;
  streak: number;
  totalXp: number;
  xpToNext: number;
}

export function deriveGameStats(gameProfile: any | null): GameStats {
  const level = gameProfile?.level ?? 1;
  const streak = gameProfile?.currentStreakDays ?? 0;
  const totalXp = gameProfile?.totalXp ?? 0;
  const xpToNext = Math.pow(level, 2) * 100 || 100;

  return {
    level,
    streak,
    totalXp,
    xpToNext,
  };
}
