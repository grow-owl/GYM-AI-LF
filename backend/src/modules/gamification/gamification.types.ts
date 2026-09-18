import { Types } from 'mongoose';

export enum BadgeCode {
  STREAK_7 = 'STREAK_7',
  STREAK_30 = 'STREAK_30',
  STREAK_100 = 'STREAK_100',
  FIRST_WORKOUT = 'FIRST_WORKOUT',
  TEN_WORKOUTS = 'TEN_WORKOUTS',
  WEIGHT_GOAL_HIT = 'WEIGHT_GOAL_HIT',
  EARLY_BIRD = 'EARLY_BIRD',
}

export type BadgeType = BadgeCode;
export const BadgeType = BadgeCode;

export const BADGE_DEFINITIONS: Record<BadgeCode, { name: string; description: string; xpReward: number }> = {
  [BadgeCode.STREAK_7]: { name: '7-Day Streak', description: 'Worked out 7 days in a row', xpReward: 200 },
  [BadgeCode.STREAK_30]: { name: '30-Day Streak', description: 'Worked out 30 days in a row', xpReward: 1000 },
  [BadgeCode.STREAK_100]: { name: '100-Day Warrior', description: 'Worked out 100 days in a row', xpReward: 5000 },
  [BadgeCode.FIRST_WORKOUT]: { name: 'First Step', description: 'Logged your very first workout', xpReward: 100 },
  [BadgeCode.TEN_WORKOUTS]: { name: 'Gym Regular', description: 'Logged 10 complete workouts', xpReward: 300 },
  [BadgeCode.WEIGHT_GOAL_HIT]: { name: 'Goal Crusher', description: 'Reached your target body weight goal', xpReward: 1500 },
  [BadgeCode.EARLY_BIRD]: { name: 'Early Bird', description: 'Checked in before 7:00 AM', xpReward: 150 },
};

export function calculateLevel(xp: number): number {
  if (xp <= 0) return 1;
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

export interface IBadgeAward {
  code: BadgeCode;
  earnedAt: Date;
}

export interface IMemberGameStats {
  _id: Types.ObjectId;
  memberId: Types.ObjectId;
  gymId: Types.ObjectId;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDayKey?: string;
  badges: IBadgeAward[];
  /**
   * Member's designated weekly rest days as JS weekday numbers (0=Sun, 1=Mon, …, 6=Sat).
   * A missed day that falls on a rest day will NOT reset the streak.
   */
  restDays: number[];
  /**
   * True when a one-time grace gap (missed 1 day, no rest-day) has been consumed
   * and not yet followed by a check-in. Resets to false on the next check-in.
   */
  streakGracePending: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChallengeParticipant {
  memberId: Types.ObjectId;
  progress: number;
  currentProgress?: number;
  isCompleted?: boolean;
  joinedAt?: Date;
  completedAt?: Date;
}

export interface IChallenge {
  _id: Types.ObjectId;
  gymId: Types.ObjectId;
  branchId?: Types.ObjectId;
  title: string;
  description: string;
  metric: 'workout_count' | 'streak_days' | 'total_minutes';
  targetValue: number;
  startDate: Date;
  endDate: Date;
  rewardXp: number;
  participants: IChallengeParticipant[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IXpLedger {
  _id: Types.ObjectId;
  memberId: Types.ObjectId;
  gymId: Types.ObjectId;
  amount: number;
  reason: string;
  earnedAt: Date;
}

export interface LevelInfo {
  level: number;
  currentXp: number;
  xpInCurrentLevel: number;
  xpNeededForNextLevel: number;
}
