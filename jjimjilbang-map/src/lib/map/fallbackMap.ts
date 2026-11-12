// 간이 지도 — 외부 지도 키 없이 서울 25개 구 경계·한강·주요 지하철역을 SVG로 그려요.
// 드래그 이동, 휠·핀치 확대를 지원하고, 찜질방 핀은 HTML 요소로 올려요.
import geo from '../../../data/seoul-geo.json';
import stationData from '../../../data/seoul-stations.json';
import type { LatLng, MapAdapter, MapHandlers, Padding, PinHtml, PinPlace } from './types';

interface GeoData { districts: { name: string; label: [number, number]; rings: [number, number][][] }[]; river: [number, number][][] }
interface StationData { lineColors: Record<string, string>; stations: [string, number, number, string][] }

const LAT0 = 37.56;
const LNG0 = 126.98;
const COS0 = Math.cos((LAT0 * Math.PI) / 180);
const SVG_NS = 'http://www.w3.org/2000/svg';

// 경위도 -> 평면 좌표 (단위 약 0.001도, y는 아래로 증가)
const project = (lng: number, lat: number) => ({ x: (lng - LNG0) * COS0 * 1000, y: (LAT0 - lat) * 1000 });

function svg(tag: string, attrs: Record<string, string>) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}
function div(cls: string) {
  const node = document.createElement('div');
  node.className = cls;
  return node;
}
const ringToPath = (ring: [number, number][]) =>
  ring.map(([lng, lat], i) => { const p = project(lng, lat); return (i ? 'L' : 'M') + p.x.toFixed(2) + ' ' + p.y.toFixed(2); }).join('') + 'Z';
const place = (node: HTMLElement, s: { x: number; y: number }) => {
  node.style.transform = `translate(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px)`;
};

interface Marker<T> { node: HTMLDivElement; p: { x: number; y: number }; place: T; selected: boolean; compact: boolean; dirty: boolean }

export class FallbackMap<T extends PinPlace> implements MapAdapter<T> {
  private root: HTMLDivElement;
  private svgEl: SVGSVGElement;
  private pinLayer: HTMLDivElement;
  private labels: { node: HTMLElement; p: { x: number; y: number } }[] = [];
  private stations: { node: HTMLElement; p: { x: number; y: number } }[] = [];
  private markers = new Map<string, Marker<T>>();
  private me: { node: HTMLDivElement; p: { x: number; y: number } } | null = null;
  private pinHtml: PinHtml<T> = () => '';
  private view = { cx: 0, cy: 0, k: 1 };
  private w = 1;
  private h = 1;
  private minK = 1;
  private lastK = 0;
  private bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  private pointers = new Map<number, { x: number; y: number }>();
  private raf = 0;
  private anim = 0;
  private ro: ResizeObserver | null = null;

  constructor(private container: HTMLElement, private handlers: MapHandlers = {}) {
    const g = geo as unknown as GeoData;
    const sd = stationData as unknown as StationData;
    this.root = div('fmap');
    this.svgEl = svg('svg', { class: 'fmap-svg', 'aria-hidden': 'true' }) as SVGSVGElement;
    const land = svg('g', {});
    const lines = svg('g', {});
    const river = svg('g', {});
    for (const d of g.districts) {
      const path = d.rings.map(ringToPath).join(' ');
      land.appendChild(svg('path', { d: path, class: 'fmap-gu' }));
      lines.appendChild(svg('path', { d: path, class: 'fmap-gu-line', 'vector-effect': 'non-scaling-stroke' }));
      for (const ring of d.rings) for (const [lng, lat] of ring) {
        const p = project(lng, lat);
        this.bounds.minX = Math.min(this.bounds.minX, p.x); this.bounds.maxX = Math.max(this.bounds.maxX, p.x);
        this.bounds.minY = Math.min(this.bounds.minY, p.y); this.bounds.maxY = Math.max(this.bounds.maxY, p.y);
      }
    }
    for (const line of g.river) {
      river.appendChild(svg('path', {
        class: 'fmap-river',
        d: line.map(([lng, lat], i) => { const p = project(lng, lat); return (i ? 'L' : 'M') + p.x.toFixed(2) + ' ' + p.y.toFixed(2); }).join(''),
      }));
    }
    this.svgEl.append(land, river, lines);

    const labelLayer = div('fmap-layer');
    labelLayer.setAttribute('aria-hidden', 'true');
    this.labels = g.districts.map((d) => {
      const node = document.createElement('span');
      node.className = 'fmap-gu-label';
      node.textContent = d.name;
      labelLayer.appendChild(node);
      return { node, p: project(d.label[0], d.label[1]) };
    });

    const stationLayer = div('fmap-layer');
    stationLayer.setAttribute('aria-hidden', 'true');
    this.stations = sd.stations.map(([name, lat, lng, line]) => {
      const node = document.createElement('span');
      node.className = 'stn';
      if (sd.lineColors[line]) node.style.setProperty('--stn', sd.lineColors[line]);
      node.innerHTML = '<i></i><b></b>';
      (node.lastChild as HTMLElement).textContent = name;
      stationLayer.appendChild(node);
      return { node, p: project(lng, lat) };
    });

    this.pinLayer = div('fmap-layer fmap-pins');
    const credit = div('fmap-credit');
    credit.textContent = '간이 지도 · 행정구역 © 통계청(2013) · 역 위치는 근사값';
    this.root.append(this.svgEl, labelLayer, stationLayer, this.pinLayer, credit);
    container.appendChild(this.root);

    this.bindGestures();
    this.resize();
    this.fitSeoul(true);
  }

  // ---------------------------------------------------------------- gestures
  private local(e: { clientX: number; clientY: number }) {
    const r = this.root.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private bindGestures() {
    let moved = 0;
    let last: { x: number; y: number; d?: number } | null = null;
    const mid = () => {
      const [a, b] = [...this.pointers.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
    };
    this.root.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.pin')) return;
      this.root.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, this.local(e));
      moved = 0;
      last = this.pointers.size === 2 ? mid() : this.local(e);
    });
    this.root.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId) || !last) return;
      this.pointers.set(e.pointerId, this.local(e));
      if (this.pointers.size === 2) {
        const m = mid();
        if (last.d) {
          this.zoomAt(m.d / last.d, m);
          this.view.cx -= (m.x - last.x) / this.view.k;
          this.view.cy -= (m.y - last.y) / this.view.k;
        }
        moved += 10;
        last = m;
      } else {
        const p = this.local(e);
        moved += Math.abs(p.x - last.x) + Math.abs(p.y - last.y);
        this.view.cx -= (p.x - last.x) / this.view.k;
        this.view.cy -= (p.y - last.y) / this.view.k;
        last = p;
      }
      this.schedule();
    });
    const end = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) {
        if (moved < 6 && e.type === 'pointerup') this.handlers.onMapClick?.();
      } else {
        last = [...this.pointers.values()][0];
      }
    };
    this.root.addEventListener('pointerup', end);
    this.root.addEventListener('pointercancel', end);
    this.root.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)), this.local(e));
      this.schedule();
    }, { passive: false });
    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.container);
    }
  }

  private clampK(k: number) {
    return Math.max(this.minK * 0.8, Math.min(this.minK * 40, k));
  }

  private zoomAt(factor: number, pt: { x: number; y: number }) {
    const v = this.view;
    const k2 = this.clampK(v.k * factor);
    const mx = v.cx + (pt.x - this.w / 2) / v.k;
    const my = v.cy + (pt.y - this.h / 2) / v.k;
    v.cx = mx - (pt.x - this.w / 2) / k2;
    v.cy = my - (pt.y - this.h / 2) / k2;
    v.k = k2;
  }

  private schedule() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); });
  }

  private toScreen(p: { x: number; y: number }) {
    const v = this.view;
    return { x: (p.x - v.cx) * v.k + this.w / 2, y: (p.y - v.cy) * v.k + this.h / 2 };
  }

  private render() {
    const v = this.view;
    const vw = this.w / v.k, vh = this.h / v.k;
    this.svgEl.setAttribute('viewBox', [v.cx - vw / 2, v.cy - vh / 2, vw, vh].map((n) => n.toFixed(3)).join(' '));
    const zoom = v.k / this.minK;
    this.root.classList.toggle('show-stations', zoom >= 1.7);
    this.root.classList.toggle('show-labels', zoom >= 2.4);
    this.root.classList.toggle('show-stn-labels', zoom >= 3.4);
    this.root.classList.toggle('hide-gu', zoom >= 3.4);
    this.labels.forEach((l) => place(l.node, this.toScreen(l.p)));
    this.stations.forEach((s) => place(s.node, this.toScreen(s.p)));
    this.markers.forEach((m) => place(m.node, this.toScreen(m.p)));
    if (this.me) place(this.me.node, this.toScreen(this.me.p));
    if (this.lastK !== v.k) {
      this.lastK = v.k;
      this.handlers.onZoomChange?.();
    }
  }

  private animateTo(cx: number, cy: number, k: number) {
    const from = { ...this.view };
    cancelAnimationFrame(this.anim);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.view = { cx, cy, k };
      this.render();
      return;
    }
    const start = performance.now();
    const step = (t: number) => {
      const u = Math.min(1, (t - start) / 360);
      const e = 1 - Math.pow(1 - u, 3);
      this.view.cx = from.cx + (cx - from.cx) * e;
      this.view.cy = from.cy + (cy - from.cy) * e;
      this.view.k = from.k * Math.pow(k / from.k, e);
      this.render();
      if (u < 1) this.anim = requestAnimationFrame(step);
    };
    this.anim = requestAnimationFrame(step);
  }

  private fitSeoul(instant = false) {
    const b = this.bounds;
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    if (instant) { this.view = { cx, cy, k: this.minK }; this.render(); }
    else this.animateTo(cx, cy, this.minK);
  }

  // ---------------------------------------------------------------- adapter
  setPlaces(places: T[], pinHtml: PinHtml<T>) {
    this.pinHtml = pinHtml;
    this.pinLayer.innerHTML = '';
    this.markers.clear();
    for (const pl of places) {
      const node = div('pin-anchor');
      node.innerHTML = pinHtml(pl, false, false);
      node.addEventListener('click', (e) => {
        if (!(e.target as HTMLElement).closest('.pin')) return;
        e.stopPropagation();
        this.handlers.onMarkerClick?.(pl.id);
      });
      this.pinLayer.appendChild(node);
      this.markers.set(pl.id, { node, p: project(pl.lng, pl.lat), place: pl, selected: false, compact: false, dirty: false });
    }
    if (this.me) this.pinLayer.appendChild(this.me.node);
    this.render();
  }

  private paint(m: Marker<T>) {
    m.node.innerHTML = this.pinHtml(m.place, m.selected, m.compact);
    m.node.classList.toggle('is-selected', m.selected);
    m.node.classList.toggle('is-compact', m.compact && !m.selected);
    m.dirty = false;
  }

  update(visibleIds: string[], selectedId: string | null) {
    const visible = new Set(visibleIds);
    this.markers.forEach((m, id) => {
      const sel = id === selectedId;
      m.node.hidden = !visible.has(id) && !sel;
      if (sel !== m.selected || m.dirty) { m.selected = sel; this.paint(m); }
    });
  }

  refreshAll() {
    this.markers.forEach((m) => this.paint(m));
  }

  setCompact(ids: Set<string>) {
    this.markers.forEach((m, id) => {
      const c = ids.has(id);
      if (c !== m.compact) { m.compact = c; this.paint(m); }
    });
  }

  toPixel(lat: number, lng: number) {
    return this.toScreen(project(lng, lat));
  }

  labelsShown() {
    return this.root.classList.contains('show-labels');
  }

  // offsetY: 아래 카드에 가려지는 만큼 핀을 위로 올려 보여줘요
  focus(p: LatLng, offsetX = 0, offsetY = 0) {
    const q = project(p.lng, p.lat);
    const k = Math.max(this.view.k, this.minK * 3.2);
    this.animateTo(q.x - offsetX / k, q.y + offsetY / k, k);
  }

  fit(points: LatLng[], padding: Padding = { top: 40, right: 40, bottom: 40, left: 40 }) {
    if (!points.length) return this.fitSeoul();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of points) {
      const p = project(pt.lng, pt.lat);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const availW = Math.max(40, this.w - padding.left - padding.right);
    const availH = Math.max(40, this.h - padding.top - padding.bottom);
    let k = Math.min(availW / Math.max(4, maxX - minX), availH / Math.max(4, maxY - minY));
    k = this.clampK(Math.min(k, this.minK * 6));
    this.animateTo((minX + maxX) / 2 - (padding.left - padding.right) / 2 / k, (minY + maxY) / 2 - (padding.top - padding.bottom) / 2 / k, k);
  }

  zoomBy(steps: number) {
    this.animateTo(this.view.cx, this.view.cy, this.clampK(this.view.k * Math.pow(1.6, steps)));
  }

  setUserPosition(pos: LatLng) {
    if (!this.me) {
      const node = div('me-anchor');
      node.innerHTML = '<span class="me-dot"></span>';
      this.pinLayer.appendChild(node);
      this.me = { node, p: project(pos.lng, pos.lat) };
    }
    this.me.p = project(pos.lng, pos.lat);
    this.render();
  }

  resize() {
    const r = this.root.getBoundingClientRect();
    // 상세 화면을 보는 동안처럼 지도가 숨겨지면(크기 0) 지금 보던 위치를 그대로 둬요.
    if (r.width < 2 || r.height < 2) return;
    const wasHidden = this.w <= 1 || this.h <= 1;
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    const b = this.bounds;
    this.minK = Math.min(this.w / (b.maxX - b.minX), this.h / (b.maxY - b.minY)) * 0.92;
    // 처음 그릴 때 크기가 0이었다면(화면에 붙기 전) 실제 크기가 생긴 뒤 서울 전체로 다시 맞춰요.
    if (wasHidden && this.w > 1 && this.h > 1) this.fitSeoul(true);
    else this.render();
  }

  destroy() {
    this.ro?.disconnect();
    cancelAnimationFrame(this.anim);
    cancelAnimationFrame(this.raf);
    this.root.remove();
  }
}
