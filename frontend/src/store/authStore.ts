import { create } from "zustand";
import { authApi, notificationApi, type AuthUser } from "@/lib/endpoints";
import { setAccessToken, ApiError } from "@/lib/api";

export interface OwnerAddress {
  line1: string;
  city: string;
  state: string;
  pincode: string;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  gymName?: string;
  address: OwnerAddress;
  avatarDataUrl?: string;
  ownerInviteCode: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True while the initial token check (on app load) or a login/register/logout call is in flight. */
  loading: boolean;
  /** True only for the very first "do we already have a session" check on app load. */
  initializing: boolean;
  error: string | null;
  /** Per-field validation errors returned by the backend, e.g. { phone: "..." }. */
  fieldErrors: Record<string, string>;
  init: () => Promise<void>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  clearError: () => void;
}

// Maps a logged-in user's role to the dashboard section they own.
export const roleHome: Record<string, string> = {
  GYM_OWNER: "/owner",
  SUPER_ADMIN: "/admin",
  BRANCH_MANAGER: "/owner",
  TRAINER: "/trainer",
  MEMBER: "/member",
  KIOSK: "/reception",
};

/** Pulls out a friendly message + per-field errors from a validation ApiError. */
function describeApiError(e: unknown, fallback: string): { message: string; fieldErrors: Record<string, string> } {
  if (e instanceof ApiError) {
    const details = e.details;
    if (Array.isArray(details) && details.length > 0) {
      const fieldErrors: Record<string, string> = {};
      for (const d of details) {
        if (d && typeof d === "object" && "field" in d && "message" in d) {
          const field = String((d as { field: unknown }).field);
          const message = String((d as { message: unknown }).message);
          if (field) fieldErrors[field] = message;
        }
      }
      const message = details
        .map((d) => (d && typeof d === "object" && "message" in d ? String((d as { message: unknown }).message) : null))
        .filter(Boolean)
        .join(" ");
      return { message: message || e.message, fieldErrors };
    }
    return { message: e.message, fieldErrors: {} };
  }
  return { message: fallback, fieldErrors: {} };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  initializing: true,
  error: null,
  fieldErrors: {},

  init: async () => {
    // Access token is in-memory only — on page reload we need to silently refresh
    // via the httpOnly refresh-token cookie. If the cookie is absent or expired,
    // the user is simply treated as logged out (no localStorage to clean up).
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1"}/auth/refresh-token`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const json = await res.json();
        const token = json?.data?.accessToken as string | undefined;
        if (token) {
          setAccessToken(token);
          const meRes = await authApi.getMe();
          set({ user: meRes.user, isAuthenticated: true });
        }
      }
    } catch {
      // No valid session — stay logged out
    } finally {
      set({ loading: false, initializing: false });
    }
  },

  register: async (input) => {
    set({ loading: true, error: null, fieldErrors: {} });
    try {
      const normalizedEmail = input.email.trim().toLowerCase();

      const { user: newUser, accessToken } = await authApi.register({
        fullName: input.fullName,
        email: normalizedEmail,
        phone: input.phone,
        password: input.password,
        role: "MEMBER",
      });
      setAccessToken(accessToken);
      set({ user: newUser, isAuthenticated: true });

      // Gym owners need a gym (+ a first branch) to use the rest of the app.
      // This mirrors the real onboarding flow: register -> create gym -> create branch.

      return newUser;
    } catch (e) {
      const { message, fieldErrors } = describeApiError(e, "Registration failed. Please check your details and try again.");
      set({ error: message, fieldErrors });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null, fieldErrors: {} });
    try {
      const { user: loggedInUser, accessToken } = await authApi.login(email, password);
      setAccessToken(accessToken);
      set({ user: loggedInUser, isAuthenticated: true });
      // Clear cached AI weekly digest so fresh login generates/fetches new data
      try {
        const gId = loggedInUser?.gymId;
        if (gId) {
          localStorage.removeItem(`gymai.weekly_digest.${gId}`);
          sessionStorage.removeItem(`gymai.weekly_digest.${gId}`);
        }
      } catch {}

      return loggedInUser;
    } catch (e) {
      const { message, fieldErrors } = describeApiError(e, "Login failed. Please check your email and password.");
      set({ error: message, fieldErrors });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    // Capture current user ID before clearing state
    const currentUser = get().user;
    const userId = currentUser?.id || currentUser?._id || '';

    // Deactivate FCM push notification token if registered
    try {
      const fcmToken = localStorage.getItem('gymai.fcmToken');
      if (fcmToken) {
        notificationApi.deactivateDeviceToken(fcmToken).catch(() => null);
        localStorage.removeItem('gymai.fcmToken');
      }
    } catch {}

    // Clear generic and user‑scoped branch selections
    try {
      localStorage.removeItem('gymai.selected_branch_id');
      localStorage.removeItem('gymai.branches_list');
      if (userId) {
        localStorage.removeItem(`gymai.selected_branch_id.${userId}`);
        localStorage.removeItem(`gymai.branches_list.${userId}`);
      }
    } catch {
      // ignore storage errors
    }

    // Clear weekly digest AI caches
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("gymai.weekly_digest")) localStorage.removeItem(k);
      });
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith("gymai.weekly_digest")) sessionStorage.removeItem(k);
      });
    } catch {}

    // Attempt to clear httpOnly refresh-token cookie on the backend first.
    // Even if this fails (e.g. network error), we still tear down the local
    // session so the user is never stuck on a logged-in screen.
    try {
      await authApi.logout();
    } catch {
      // Graceful degradation — refresh token may dangle, but local session is cleared.
    }
    setAccessToken(null);
    set({ user: null, isAuthenticated: false });
  },

  clearError: () => set({ error: null, fieldErrors: {} }),
}));

/** Back-compat hook so existing call sites (`useAuth()`) keep working after the Redux/Context -> Zustand migration. */
export function useAuth() {
  return useAuthStore();
}
