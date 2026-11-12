// 네이버 지도(NAVER Maps JavaScript API v3) 어댑터 — 선택 사항이에요.
// .env 에 VITE_NAVER_MAP_KEY_ID 를 넣으면 간이 지도 대신 이 어댑터를 써요.
//
// NCP 콘솔의 Maps 애플리케이션에 서비스 주소(예: Vercel 도메인, 개발용 localhost)를 등록해야 지도가 떠요.
// 인증에 실패하면 간이 지도로 자동으로 바꿔요.
import type { LatLng, MapAdapter, MapHandlers, Padding, PinHtml, PinPlace } from './types';

declare global {
  interface Window { naver?: any; navermap_authFailure?: () => void }
}

const SCRIPT_URL = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=';
const LABEL_ZOOM = 14;

export function loadNaverMaps(keyId: string, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.naver?.maps?.Map) return resolve();
    let done = false;
    const finish = (err?: Error) => { if (done) return; done = true; err ? reject(err) : resolve(); };
    const s = document.createElement('script');
    s.src = SCRIPT_URL + encodeURIComponent(keyId);
    s.async = true;
    s.onload = () => (window.naver?.maps ? finish() : finish(new Error('NAVER_MAPS_MISSING')));
    s.onerror = () => finish(new Error('NAVER_MAPS_LOAD_FAILED'));
    setTimeout(() => finish(new Error('NAVER_MAPS_TIMEOUT')), timeoutMs);
    document.head.appendChild(s);
  });
}

interface Marker<T> { marker: any; place: T; selected: boolean; compact: boolean }

export class NaverMap<T extends PinPlace> implements MapAdapter<T> {
  private maps: any;
  private map: any;
  private markers = new Map<string, Marker<T>>();
  private me: any = null;
  private pinHtml: PinHtml<T> = () => '';

  constructor(private container: HTMLElement, private handlers: MapHandlers = {}, center: LatLng = { lat: 37.5465, lng: 126.99 }) {
    this.maps = window.naver.maps;
    const maps = this.maps;
    this.map = new maps.Map(container, {
      center: new maps.LatLng(center.lat, center.lng),
      zoom: 11,
      minZoom: 9,
      zoomControl: false,
      mapTypeControl: false,
      scaleControl: true,
      logoControl: true,
      mapDataControl: true,
    });
    maps.Event.addListener(this.map, 'click', () => this.handlers.onMapClick?.());
    maps.Event.addListener(this.map, 'zoom_changed', () => { this.syncLabels(); this.handlers.onZoomChange?.(); });
    this.syncLabels();
  }

  private syncLabels() {
    this.container.classList.toggle('show-labels', this.map.getZoom() >= LABEL_ZOOM);
  }

  private icon(p: T, selected: boolean, compact: boolean) {
    const cls = 'pin-anchor' + (selected ? ' is-selected' : '') + (compact && !selected ? ' is-compact' : '');
    return { content: `<div class="${cls}">${this.pinHtml(p, selected, compact)}</div>`, anchor: new this.maps.Point(0, 0) };
  }

  setPlaces(places: T[], pinHtml: PinHtml<T>) {
    this.pinHtml = pinHtml;
    this.markers.forEach((m) => m.marker.setMap(null));
    this.markers.clear();
    for (const p of places) {
      const marker = new this.maps.Marker({
        position: new this.maps.LatLng(p.lat, p.lng),
        map: this.map,
        icon: this.icon(p, false, false),
        zIndex: 10,
      });
      this.maps.Event.addListener(marker, 'click', () => this.handlers.onMarkerClick?.(p.id));
      this.markers.set(p.id, { marker, place: p, selected: false, compact: false });
    }
  }

  private paint(m: Marker<T>) {
    m.marker.setIcon(this.icon(m.place, m.selected, m.compact));
    m.marker.setZIndex(m.selected ? 1000 : m.compact ? 5 : 10);
  }

  update(visibleIds: string[], selectedId: string | null) {
    const visible = new Set(visibleIds);
    this.markers.forEach((m, id) => {
      const sel = id === selectedId;
      m.marker.setVisible(visible.has(id) || sel);
      if (sel !== m.selected) { m.selected = sel; this.paint(m); }
    });
  }

  refreshAll() { this.markers.forEach((m) => this.paint(m)); }

  setCompact(ids: Set<string>) {
    this.markers.forEach((m, id) => {
      const c = ids.has(id);
      if (c !== m.compact) { m.compact = c; this.paint(m); }
    });
  }

  toPixel(lat: number, lng: number) {
    try {
      const pt = this.map.getProjection().fromCoordToOffset(new this.maps.LatLng(lat, lng));
      return { x: pt.x, y: pt.y };
    } catch {
      return null;
    }
  }

  labelsShown() {
    return this.container.classList.contains('show-labels');
  }

  focus(p: LatLng, offsetX = 0, offsetY = 0) {
    let target = new this.maps.LatLng(p.lat, p.lng);
    if (this.map.getZoom() < 15) this.map.setZoom(15, false);
    try {
      const proj = this.map.getProjection();
      const pt = proj.fromCoordToOffset(target);
      target = proj.fromOffsetToCoord(new this.maps.Point(pt.x - offsetX, pt.y + offsetY));
    } catch { /* 오프셋 없이 이동 */ }
    this.map.panTo(target);
  }

  fit(points: LatLng[], padding?: Padding) {
    if (!points.length) return;
    const b = new this.maps.LatLngBounds(new this.maps.LatLng(points[0].lat, points[0].lng), new this.maps.LatLng(points[0].lat, points[0].lng));
    points.forEach((p) => b.extend(new this.maps.LatLng(p.lat, p.lng)));
    this.map.fitBounds(b, padding ?? { top: 40, right: 40, bottom: 40, left: 40 });
  }

  zoomBy(steps: number) { this.map.setZoom(this.map.getZoom() + steps, true); }

  setUserPosition(pos: LatLng) {
    const ll = new this.maps.LatLng(pos.lat, pos.lng);
    if (this.me) { this.me.setPosition(ll); return; }
    this.me = new this.maps.Marker({
      position: ll, map: this.map, clickable: false, zIndex: 5,
      icon: { content: '<div class="me-anchor"><span class="me-dot"></span></div>', anchor: new this.maps.Point(0, 0) },
    });
  }

  resize() {
    const r = this.container.getBoundingClientRect();
    if (r.width && r.height) this.map.setSize(new this.maps.Size(r.width, r.height));
  }

  destroy() {
    this.markers.forEach((m) => m.marker.setMap(null));
    this.me?.setMap(null);
    this.map?.destroy?.();
  }
}
