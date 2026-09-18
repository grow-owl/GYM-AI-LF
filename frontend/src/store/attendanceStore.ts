import { create } from "zustand";
import { attendanceApi } from "@/lib/endpoints";

interface AttendanceState {
  isCheckedIn: boolean;
  currentSession: any | null;
  loading: boolean;
  initialized: boolean;
  fetchCurrentSession: () => Promise<void>;
  setSession: (session: any | null) => void;
}

export const useAttendanceStore = create<AttendanceState>((set, get) => {
  // Global listener for cross-component sync
  if (typeof window !== "undefined") {
    const handleSync = () => {
      get().fetchCurrentSession();
    };
    window.addEventListener("gymai:attendance-updated", handleSync);
    window.addEventListener("gymai:workout-updated", handleSync);
  }

  return {
    isCheckedIn: false,
    currentSession: null,
    loading: false,
    initialized: false,

    fetchCurrentSession: async () => {
      set({ loading: true });
      try {
        const res = await attendanceApi.getCurrentSession();
        const session = res?.session ?? (res as any)?.data?.session ?? null;
        const isCheckedIn = Boolean(
          session && (session.status === "CHECKED_IN" || session.status === "checked_in")
        );
        set({
          currentSession: isCheckedIn ? session : null,
          isCheckedIn,
          loading: false,
          initialized: true,
        });
      } catch {
        set({ currentSession: null, isCheckedIn: false, loading: false, initialized: true });
      }
    },

    setSession: (session: any | null) => {
      const isCheckedIn = Boolean(
        session && (session.status === "CHECKED_IN" || session.status === "checked_in")
      );
      set({
        currentSession: isCheckedIn ? session : null,
        isCheckedIn,
        initialized: true,
      });
    },
  };
});
