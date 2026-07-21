import { useCallback, useEffect, useState } from "react";
import type { Profile } from "@/lib/gearCatalog";

/**
 * Personal, device-local Gear Guide state — saved products, recently viewed,
 * and the last "for you" profile. This is a browser convenience (localStorage),
 * not tenant data, so it deliberately never touches the backend.
 */

const FAV_KEY = "ds.gear.favorites";
const RECENT_KEY = "ds.gear.recent";
const PROFILE_KEY = "ds.gear.profile";
const RECENT_MAX = 12;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota — non-fatal */
  }
}

export function useGearLocker() {
  const [favorites, setFavorites] = useState<string[]>(() => read<string[]>(FAV_KEY, []));
  const [recent, setRecent] = useState<string[]>(() => read<string[]>(RECENT_KEY, []));
  const [profile, setProfile] = useState<Profile | null>(() => read<Profile | null>(PROFILE_KEY, null));

  useEffect(() => write(FAV_KEY, favorites), [favorites]);
  useEffect(() => write(RECENT_KEY, recent), [recent]);
  useEffect(() => write(PROFILE_KEY, profile), [profile]);

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [id, ...f]));
  }, []);

  const recordView = useCallback((id: string) => {
    setRecent((r) => [id, ...r.filter((x) => x !== id)].slice(0, RECENT_MAX));
  }, []);

  const clearRecent = useCallback(() => setRecent([]), []);

  const saveProfile = useCallback((p: Profile) => setProfile(p), []);

  return { favorites, recent, profile, isFavorite, toggleFavorite, recordView, clearRecent, saveProfile };
}
