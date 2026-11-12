import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useToast } from './ui';
import type { LatLng } from './lib/map/types';
import { getUserLocation, haptic, LocationDeniedError, storage } from './lib/device';

interface AppState {
  favs: Set<string>;
  toggleFav: (id: string) => void;
  userPos: LatLng | null;
  locate: () => Promise<LatLng | null>;
  /** 다른 곳(예: 길찾기)에서 받은 현재 위치를 기억해 거리 표시에 써요 */
  rememberPos: (pos: LatLng) => void;
  toast: (message: string) => void;
}

const Ctx = createContext<AppState | null>(null);
const FAV_KEY = 'jjim:favs';

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { openToast } = useToast();
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [userPos, setUserPos] = useState<LatLng | null>(null);

  useEffect(() => {
    storage.get(FAV_KEY).then((v) => {
      if (!v) return;
      try { setFavs(new Set(JSON.parse(v) as string[])); } catch { /* 깨진 값은 무시 */ }
    }).catch(() => {});
  }, []);

  const toast = useCallback((message: string) => openToast(message), [openToast]);

  const toggleFav = useCallback((id: string) => {
    setFavs((prev) => {
      const next = new Set(prev);
      const on = !next.has(id);
      if (on) next.add(id); else next.delete(id);
      storage.set(FAV_KEY, JSON.stringify([...next])).catch(() => {});
      haptic();
      openToast(on ? '찜 목록에 담았어요' : '찜 목록에서 뺐어요');
      return next;
    });
  }, [openToast]);

  const locate = useCallback(async () => {
    try {
      const pos = await getUserLocation();
      setUserPos(pos);
      return pos;
    } catch (e) {
      openToast(e instanceof LocationDeniedError ? '위치 권한을 허용하면 가까운 찜질방을 보여드려요' : '지금은 위치를 가져올 수 없어요');
      return null;
    }
  }, [openToast]);

  const rememberPos = useCallback((pos: LatLng) => setUserPos(pos), []);

  const value = useMemo(() => ({ favs, toggleFav, userPos, locate, rememberPos, toast }), [favs, toggleFav, userPos, locate, rememberPos, toast]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppStateProvider 안에서 써야 해요');
  return v;
}
