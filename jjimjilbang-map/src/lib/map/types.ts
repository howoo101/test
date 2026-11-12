// 지도 어댑터 공통 규격 — 간이 지도(SVG)와 네이버 지도가 같은 메서드를 가져요.
export interface LatLng { lat: number; lng: number }
export interface Padding { top: number; right: number; bottom: number; left: number }
export interface PinPlace extends LatLng { id: string }

/** groupCount: 이 핀이 대표로 묶은 장소 수(자기 포함). 1이면 혼자예요 */
export type PinHtml<T extends PinPlace> = (place: T, selected: boolean, groupCount: number) => string;

export interface MapHandlers {
  onMarkerClick?: (id: string) => void;
  onMapClick?: () => void;
  onZoomChange?: () => void;
}

export interface MapAdapter<T extends PinPlace> {
  setPlaces(places: T[], pinHtml: PinHtml<T>): void;
  update(visibleIds: string[], selectedId: string | null): void;
  refreshAll(): void;
  /** 겹친 핀 묶기: hidden 은 숨길 핀, counts 는 대표 핀이 묶은 장소 수 */
  setGroups(hidden: Set<string>, counts: Map<string, number>): void;
  toPixel(lat: number, lng: number): { x: number; y: number } | null;
  /** 핀 아래 이름표가 보이는 확대 수준인지 */
  labelsShown(): boolean;
  focus(p: LatLng, offsetX?: number, offsetY?: number): void;
  /** close: 묶인 핀을 펼칠 때처럼 아주 가까이까지 확대해도 돼요 */
  fit(points: LatLng[], padding?: Padding, close?: boolean): void;
  zoomBy(steps: number): void;
  setUserPosition(pos: LatLng): void;
  resize(): void;
  destroy(): void;
}
