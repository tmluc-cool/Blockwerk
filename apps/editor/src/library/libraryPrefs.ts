import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** How many recently used library entries are remembered. */
const RECENT_LIMIT = 40;

interface LibraryPrefsState {
  /** Favorite library entries (IDs). */
  favorites: string[];
  /** Recently placed library entries (IDs), newest first. */
  recent: string[];
  /** Size of the preview tiles in pixels. */
  tileSize: number;
  toggleFavorite: (id: string) => void;
  markUsed: (id: string) => void;
  setTileSize: (size: number) => void;
}

/** Favorites and recently used models of the asset library (per user, not per project). */
export const useLibraryPrefs = create<LibraryPrefsState>()(
  persist(
    (set) => ({
      favorites: [],
      recent: [],
      tileSize: 96,
      toggleFavorite: (id) =>
        set((state) => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter((item) => item !== id)
            : [...state.favorites, id],
        })),
      markUsed: (id) =>
        set((state) => ({
          recent: [id, ...state.recent.filter((item) => item !== id)].slice(0, RECENT_LIMIT),
        })),
      setTileSize: (tileSize) => set({ tileSize }),
    }),
    { name: 'blockwerk.library', version: 1 },
  ),
);
