// 지도 어댑터 공통 규격 — 간이 지도(SVG)와 네이버 지도가 같은 메서드를 가져요.
export interface LatLng { lat: number; lng: number }
export interface Padding { top: number; right: number; bottom: number; left: number }
export interface PinPlace extends LatLng { id: string }

export type PinHtml<T extends PinPlace> = (place: T, selected: boolean, compact: boolean) => string;

export interface MapHandlers {
  onMarkerClick?: (id: string) => void;
  onMapClick?: () => void;
  onZoomChange?: () => void;
}

export interface MapAdapter<T extends PinPlace> {
  setPlaces(places: T[], pinHtml: PinHtml<T>): void;
  update(visibleIds: string[], selectedId: string | null): void;
  refreshAll(): void;
  setCompact(ids: Set<string>): void;
  toPixel(lat: number, lng: number): { x: number; y: number } | null;
  /** 핀 아래 이름표가 보이는 확대 수준인지 */
  labelsShown(): boolean;
  focus(p: LatLng, offsetX?: number, offsetY?: number): void;
  fit(points: LatLng[], padding?: Padding): void;
  zoomBy(steps: number): void;
  setUserPosition(pos: LatLng): void;
  resize(): void;
  destroy(): void;
}
