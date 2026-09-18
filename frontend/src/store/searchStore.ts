import { create } from "zustand";

interface SearchState {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  /** Clear search query — call on page unmount to prevent stale query bleeding into other pages. */
  clearSearchQuery: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  clearSearchQuery: () => set({ searchQuery: "" }),
}));
