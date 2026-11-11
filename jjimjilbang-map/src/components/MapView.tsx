import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { List } from '@toss/tds-mobile';
import { useApp } from '../AppContext';
import { BY_ID, PLACES, type Place } from '../lib/data';
import { FallbackMap } from '../lib/map/fallbackMap';
import { loadNaverMaps, NaverMap } from '../lib/map/naverMap';
import type { MapAdapter, MapHandlers } from '../lib/map/types';
import { Icon } from './Icon';
import { pinHtml, PlaceRow } from './PlaceBits';

// 네이버 지도 키를 넣으면(.env 의 VITE_NAVER_MAP_KEY_ID) 네이버 지도, 없으면 간이 지도를 써요.
const NAVER_KEY = import.meta.env.VITE_NAVER_MAP_KEY_ID as string | undefined;
const CARD_SPACE = 120; // 아래 장소 카드가 차지하는 높이(핀을 그만큼 위로 올려 보여줘요)

interface Props {
  places: Place[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpen: (id: string) => void;
  active: boolean;
  fitKey: string;
}

export function MapView({ places, selectedId, onSelect, onOpen, active, fitKey }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MapAdapter<Place> | null>(null);
  const { favs, userPos, locate } = useApp();
  const [ready, setReady] = useState(false);
  const visibleIds = useMemo(() => places.map((p) => p.id), [places]);

  // 지도 이벤트 핸들러는 처음 한 번만 등록하므로 최신 값을 ref로 읽어요.
  const latest = useRef({ visibleIds, selectedId, favs, onSelect });
  latest.current = { visibleIds, selectedId, favs, onSelect };

  // 핀이 겹치면 추천순이 낮은 쪽을 작은 점으로 줄여요. 확대하면 다시 펼쳐져요.
  const timer = useRef(0);
  const declutter = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const { visibleIds: ids, selectedId: sel } = latest.current;
    const visible = new Set(ids);
    const order = PLACES.filter((p) => visible.has(p.id))
      .sort((a, b) => Number(b.id === sel) - Number(a.id === sel) || a.index - b.index);
    const boxes: { x1: number; x2: number; y1: number; y2: number }[] = [];
    const compact = new Set<string>();
    const labels = m.labelsShown();
    for (const p of order) {
      const pt = m.toPixel(p.lat, p.lng);
      if (!pt) continue;
      // 이름표가 보이면(확대했거나 선택한 핀) 핀 아래 이름표 자리까지 겹침 판단에 넣어요.
      const withLabel = labels || p.id === sel;
      const pinW = p.id === sel ? 104 : (p.minPrice ? 70 : 84) + (p.gender === 'female' ? 26 : 0);
      const w = withLabel ? Math.max(pinW, p.name.length * 12 + 8) : pinW;
      const r = { x1: pt.x - w / 2, x2: pt.x + w / 2, y1: pt.y - 42, y2: pt.y + (withLabel ? 20 : -6) };
      if (p.id !== sel && boxes.some((b) => r.x1 < b.x2 && r.x2 > b.x1 && r.y1 < b.y2 && r.y2 > b.y1)) compact.add(p.id);
      else boxes.push(r);
    }
    m.setCompact(compact);
  }, []);
  const scheduleDeclutter = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(declutter, 90);
  }, [declutter]);

  useEffect(() => {
    const container = el.current!;
    let cancelled = false;
    const handlers: MapHandlers = {
      onMarkerClick: (id) => latest.current.onSelect(id),
      onMapClick: () => latest.current.onSelect(null),
      onZoomChange: scheduleDeclutter,
    };
    const html = (p: Place, sel: boolean, compact: boolean) => pinHtml(p, sel, compact, latest.current.favs.has(p.id));
    const start = (adapter: MapAdapter<Place>) => {
      if (cancelled) { adapter.destroy(); return; }
      map.current = adapter;
      adapter.setPlaces(PLACES, html);
      adapter.update(latest.current.visibleIds, latest.current.selectedId);
      setReady(true);
      scheduleDeclutter();
    };
    if (NAVER_KEY) {
      loadNaverMaps(NAVER_KEY)
        .then(() => start(new NaverMap<Place>(container, handlers)))
        .catch(() => start(new FallbackMap<Place>(container, handlers)));
    } else {
      start(new FallbackMap<Place>(container, handlers));
    }
    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
      map.current?.destroy();
      map.current = null;
    };
  }, [scheduleDeclutter]);

  useEffect(() => {
    if (!ready) return;
    map.current?.update(visibleIds, selectedId);
    scheduleDeclutter();
  }, [ready, visibleIds, selectedId, scheduleDeclutter]);

  useEffect(() => {
    if (!ready) return;
    map.current?.refreshAll();
  }, [ready, favs]);

  useEffect(() => {
    if (ready && userPos) map.current?.setUserPosition(userPos);
  }, [ready, userPos]);

  // 검색어·필터가 바뀌면 결과가 다 보이게 맞춰요.
  useEffect(() => {
    if (!ready || !places.length) return;
    map.current?.fit(places, { top: 48, right: 56, bottom: 40, left: 40 });
    // places 는 fitKey(검색어·필터)가 바뀔 때만 다시 맞춰요.
  }, [ready, fitKey]);

  useEffect(() => {
    if (!ready || !selectedId) return;
    map.current?.focus(BY_ID[selectedId], 0, CARD_SPACE / 2);
  }, [ready, selectedId]);

  useEffect(() => {
    if (active) map.current?.resize();
  }, [active]);

  const selected = selectedId ? BY_ID[selectedId] : null;

  const onLocate = async () => {
    const pos = await locate();
    if (pos) map.current?.focus(pos, 0, selected ? CARD_SPACE / 2 : 0);
  };

  return (
    <div className="map-view">
      <div className="map-canvas" ref={el} />
      <div className="map-ctrl">
        <button type="button" className="mc-btn mc-solo" onClick={onLocate} aria-label="내 위치 보기"><Icon name="locate" /></button>
        <div className="mc-group">
          <button type="button" className="mc-btn" onClick={() => map.current?.zoomBy(1)} aria-label="지도 확대"><Icon name="plus" /></button>
          <button type="button" className="mc-btn" onClick={() => map.current?.zoomBy(-1)} aria-label="지도 축소"><Icon name="minus" /></button>
        </div>
        <button type="button" className="mc-btn mc-solo" onClick={() => map.current?.fit(places.length ? places : PLACES, { top: 48, right: 56, bottom: 40, left: 40 })} aria-label="찜질방 전체 보기"><Icon name="expand" /></button>
      </div>
      {selected ? (
        <div className="map-card">
          <List>
            <PlaceRow place={selected} onClick={() => onOpen(selected.id)} withReview={false} />
          </List>
        </div>
      ) : (
        <p className="map-hint">핀을 누르면 요금과 영업 상태를 볼 수 있어요</p>
      )}
    </div>
  );
}
