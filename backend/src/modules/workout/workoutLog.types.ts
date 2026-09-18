import { Types } from 'mongoose';

export interface ILoggedSet {
  setNumber: number;
  reps: number;
  weightKg?: number;
  completed: boolean;
}

export interface ILoggedExercise {
  exerciseId: Types.ObjectId;
  sets: ILoggedSet[];
  completedAt?: Date;
}

export interface IWorkoutLog {
  _id: Types.ObjectId;
  gymId: Types.ObjectId;
  memberId: Types.ObjectId;
  workoutPlanId?: Types.ObjectId; // null if ad-hoc/freestyle workout
  attendanceId?: Types.ObjectId;  // links to the check-in session (Module 05)
  dayLabel?: string;              // which day of the plan was followed
  dayIndex?: number;              // which index in plan.days[] this log corresponds to (0-based)
  exercises: ILoggedExercise[];
  startedAt: Date;
  completedAt?: Date;
  totalDurationMinutes?: number;
  dayKey: string; // for streak/history grouping (YYYY-MM-DD)
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkoutCompletionStats {
  totalWorkoutSessions: number;
  completedWorkoutSessions: number;
  totalPlannedExercises: number;
  totalCompletedExercises: number;
  completionRatePercent: number;
  mostSkippedExercises: { exerciseId: string; name: string; skipCount: number }[];
  exerciseStats: { exerciseId: string; name: string; maxWeightKg: number; volume: number }[];
  weeklyVolumeLogs: { day: string; volume: number; label: string }[];
}

// ─── Spec Section 2.3 / Step B ───────────────────────────────────────────────
// Response shape for GET /api/v1/workout-logs/today
// Merges Blueprint (WorkoutPlan.days[dayIndex]) with today's Log state
export interface TodayWorkoutExercise {
  exerciseId: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  targetSets: number;
  targetReps: number;
  restSeconds: number;
  order: number;
  isCompleted: boolean; // true if exerciseId is in completedExerciseIds
}

export interface TodayWorkoutResponse {
  logId: string | null;           // null if no log created yet for today
  planId: string;
  planTitle: string;
  dayIndex: number;               // which day of the plan (0-based)
  dayLabel: string;               // e.g. "Day 1 — Push"
  totalExercises: number;
  completedExerciseIds: string[]; // exerciseIds checked off today
  exercises: TodayWorkoutExercise[];
  isCompleted?: boolean;
}

// ─── Spec Section 5 ──────────────────────────────────────────────────────────
// Strictly-typed time-series point for the progress line chart (X=date, Y=%)
export interface ChartDataPoint {
  date: string;                 // ISO date e.g. "2026-09-04"
  completionPercentage: number; // 0–100 integer
}
