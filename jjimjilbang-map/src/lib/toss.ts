// 앱인토스 SDK 호출을 한곳에 모았어요.
// 토스 앱 안에서는 SDK(네이티브 기능)를 쓰고, 일반 브라우저(개발·미리보기)에서는 웹 API로 대신해요.
// SDK는 토스 앱 WebView 밖에서 호출하면 오류를 던지므로 항상 이 파일의 함수를 거쳐서 써요.
import {
  Accuracy,
  Clipboard,
  Device,
  Environment,
  GetCurrentLocationPermissionError,
  Share,
  Storage,
  graniteEvent,
} from '@apps-in-toss/web-framework';

// apps-in-toss.config.ts 의 appName 과 같아야 해요.
export const APP_NAME = 'seoul-jjimjilbang-map';

/** 실제 토스 앱 WebView 안인지 (네이티브 브리지가 있는지) */
export function isInTossApp(): boolean {
  return typeof window !== 'undefined' && (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView != null;
}

export class LocationDeniedError extends Error {
  constructor() {
    super('위치 권한이 없어요');
    this.name = 'LocationDeniedError';
  }
}

function browserLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('이 브라우저에서는 위치를 쓸 수 없어요'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new LocationDeniedError()),
      { timeout: 8000, maximumAge: 60000 },
    );
  });
}

/**
 * 현재 위치를 한 번 가져와요.
 * 권한이 없으면 토스 권한 안내 창을 띄우고, 그래도 거부하면 LocationDeniedError 를 던져요.
 */
export async function getUserLocation(): Promise<{ lat: number; lng: number }> {
  const read = async () => {
    const loc = await Device.getLocation({ accuracy: Accuracy.Balanced });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  };
  try {
    return await read();
  } catch (error) {
    if (error instanceof GetCurrentLocationPermissionError) {
      const result = await Device.getLocation.openPermissionDialog().catch(() => 'denied' as const);
      if (result === 'allowed') return read();
      throw new LocationDeniedError();
    }
    // 토스 앱 밖(브리지 없음) → 브라우저 위치 API
    return browserLocation();
  }
}

/** 네이버 지도·블로그·인스타그램 같은 바깥 페이지를 열어요. */
export async function openExternal(url: string) {
  if (isInTossApp()) {
    await Device.openURL(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * 다른 앱(예: 네이버 지도 앱의 길찾기)을 바로 열어요. 앱이 없어서 열리지 않으면 webUrl을 열어요.
 * - 토스 앱: Device.openURL 이 기기에서 그 주소를 처리할 앱을 찾아 열어요. 실패하면 웹 주소로.
 * - 휴대폰 브라우저: 앱 주소로 이동해 보고, 1.5초 안에 화면을 떠나지 않으면 웹 주소로.
 * - 데스크톱 브라우저: 앱이 없으니 바로 웹 주소를 새 탭으로.
 */
export async function openAppWithFallback(appUrl: string, webUrl: string) {
  if (isInTossApp()) {
    try {
      await Device.openURL(appUrl);
    } catch {
      await Device.openURL(webUrl);
    }
    return;
  }
  if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    window.open(webUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  let left = false;
  const onHide = () => { if (document.visibilityState === 'hidden') left = true; };
  document.addEventListener('visibilitychange', onHide);
  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onHide);
    if (!left) window.location.href = webUrl;
  }, 1500);
  window.location.href = appUrl;
}

export async function copyText(text: string) {
  if (isInTossApp()) {
    await Clipboard.setText(text);
    return;
  }
  await navigator.clipboard.writeText(text);
}

/** 찜질방 하나를 공유해요. 토스 앱에서는 미니앱으로 바로 열리는 링크를 만들어 공유 시트를 띄워요. */
export async function sharePlace(id: string, name: string): Promise<'shared' | 'copied'> {
  if (isInTossApp()) {
    const link = await Share.createLink({ path: `intoss://${APP_NAME}?place=${encodeURIComponent(id)}` });
    await Share.sendMessage({ message: `${name} 요금·시설 정보를 확인해 보세요\n${link}` });
    return 'shared';
  }
  const url = `${location.href.split('#')[0]}#${id}`;
  if (navigator.share) {
    await navigator.share({ title: name, url });
    return 'shared';
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}

/** 찜 목록 같은 작은 값을 저장해요 (토스 앱: 네이티브 저장소, 브라우저: localStorage). */
export const storage = {
  async get(key: string): Promise<string | null> {
    if (isInTossApp()) return Storage.getItem(key);
    try { return localStorage.getItem(key); } catch { return null; }
  },
  async set(key: string, value: string): Promise<void> {
    if (isInTossApp()) { await Storage.setItem(key, value); return; }
    try { localStorage.setItem(key, value); } catch { /* 저장할 수 없는 환경 */ }
  },
};

export function haptic() {
  if (!isInTossApp()) return;
  Device.triggerHaptic({ type: 'tickWeak' }).catch(() => {});
}

/** 토스 내비게이션 바의 뒤로 가기를 직접 처리해요. 반환값을 호출하면 구독을 해제해요. */
export function subscribeBack(handler: () => void): () => void {
  if (!isInTossApp()) return () => {};
  try {
    return graniteEvent.addEventListener('backEvent', { onEvent: handler, onError: () => {} });
  } catch {
    return () => {};
  }
}

/** 공유 링크(intoss://앱이름?place=id)나 주소(#id)로 들어왔을 때 열 찜질방 id */
export function initialPlaceId(): string | null {
  const pick = (s: string) => /[?&]place=([a-z0-9-]+)/.exec(s)?.[1] ?? null;
  const fromHash = location.hash.replace(/^#/, '');
  let id = pick(location.search) || (/^[a-z0-9-]+$/.test(fromHash) ? fromHash : null);
  if (!id && isInTossApp()) {
    try { id = pick(Environment.initialURL); } catch { /* 무시 */ }
  }
  return id;
}
