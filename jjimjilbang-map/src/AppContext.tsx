import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useToast } from './ui';
import type { LatLng } from './lib/map/types';
import { getUserLocation, haptic, LocationDeniedError, storage } from './lib/device';
import { VISIT_KEY, newVisitId, parseVisits, sortVisits, type Visit, type VisitMap } from './lib/visits';

interface AppState {
  favs: Set<string>;
  toggleFav: (id: string) => void;
  userPos: LatLng | null;
  locate: () => Promise<LatLng | null>;
  /** 다른 곳(예: 길찾기)에서 받은 현재 위치를 기억해 거리 표시에 써요 */
  rememberPos: (pos: LatLng) => void;
  toast: (message: string) => void;
  /** 내 방문 기록 (장소 id → 최근순 목록) */
  visits: VisitMap;
  /** 기록을 새로 넣거나(id 없음) 고쳐요 */
  saveVisit: (placeId: string, v: Omit<Visit, 'id' | 'updatedAt'> & { id?: string }) => void;
  removeVisit: (placeId: string, visitId: string) => void;
}

const Ctx = createContext<AppState | null>(null);
const FAV_KEY = 'jjim:favs';

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { openToast } = useToast();
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [visits, setVisits] = useState<VisitMap>({});

  useEffect(() => {
    storage.get(FAV_KEY).then((v) => {
      if (!v) return;
      try { setFavs(new Set(JSON.parse(v) as string[])); } catch { /* 깨진 값은 무시 */ }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    storage.get(VISIT_KEY).then((v) => setVisits(parseVisits(v))).catch(() => {});
  }, []);

  const writeVisits = useCallback((update: (prev: VisitMap) => VisitMap) => {
    setVisits((prev) => {
      const next = update(prev);
      storage.set(VISIT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const saveVisit = useCallback<AppState['saveVisit']>((placeId, v) => {
    writeVisits((prev) => {
      const list = prev[placeId] ?? [];
      const item: Visit = { id: v.id ?? newVisitId(), date: v.date, rating: v.rating, text: v.text.trim(), updatedAt: new Date().toISOString() };
      const rest = list.filter((x) => x.id !== item.id);
      return { ...prev, [placeId]: sortVisits([...rest, item]) };
    });
    haptic();
    openToast(v.id ? '기록을 고쳤어요' : '기록을 남겼어요');
  }, [writeVisits, openToast]);

  const removeVisit = useCallback((placeId: string, visitId: string) => {
    writeVisits((prev) => {
      const list = (prev[placeId] ?? []).filter((x) => x.id !== visitId);
      const next = { ...prev };
      if (list.length) next[placeId] = list; else delete next[placeId];
      return next;
    });
    openToast('기록을 지웠어요');
  }, [writeVisits, openToast]);

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

  const value = useMemo(
    () => ({ favs, toggleFav, userPos, locate, rememberPos, toast, visits, saveVisit, removeVisit }),
    [favs, toggleFav, userPos, locate, rememberPos, toast, visits, saveVisit, removeVisit],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppStateProvider 안에서 써야 해요');
  return v;
}
