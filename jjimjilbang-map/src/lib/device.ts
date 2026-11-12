// 위치·외부 링크·공유·복사·저장 같은 기기 기능을 브라우저 API로 다뤄요.

export class LocationDeniedError extends Error {
  constructor() {
    super('위치 권한이 없어요');
    this.name = 'LocationDeniedError';
  }
}

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** 현재 위치를 한 번 가져와요. 권한을 거부하면 LocationDeniedError 를 던져요. */
export function getUserLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('이 브라우저에서는 위치를 쓸 수 없어요'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err.code === err.PERMISSION_DENIED ? new LocationDeniedError() : new Error(err.message)),
      { timeout: 8000, maximumAge: 60000 },
    );
  });
}

/** 네이버 지도·블로그·유튜브·인스타그램 같은 바깥 페이지를 새 탭으로 열어요. 전화(tel:)는 바로 걸어요. */
export async function openExternal(url: string) {
  if (/^tel:/.test(url)) {
    window.location.href = url;
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * 다른 앱(예: 네이버 지도 앱의 길찾기)을 바로 열어요. 앱이 없으면 webUrl 을 열어요.
 * - 휴대폰: 앱 주소로 이동해 보고, 1.5초 안에 화면을 떠나지 않으면(앱이 없으면) 웹 주소로 가요.
 * - 컴퓨터: 앱이 없으니 바로 웹 주소를 새 탭으로 열어요.
 */
export async function openAppWithFallback(appUrl: string, webUrl: string) {
  if (!isMobile()) {
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

/**
 * 네이버 지도 길찾기를 현재 위치 출발로 열어요.
 * - 휴대폰: 네이버 지도 앱(출발지를 비우면 앱이 현재 위치에서 출발해요). 앱이 없으면 웹 길찾기로.
 * - 컴퓨터: 새 탭을 먼저 열어 두고(팝업 차단 방지), 브라우저 위치를 받아 출발지에 넣은 웹 길찾기로 보내요.
 *   위치를 못 받으면 출발지를 비운 채로 열어요.
 * 받은 위치를 돌려줘요(못 받았으면 null).
 */
export async function openNaverDirections(
  appUrl: string,
  webUrl: (from: { lat: number; lng: number } | null) => string,
  knownPos: { lat: number; lng: number } | null,
): Promise<{ lat: number; lng: number } | null> {
  if (isMobile()) {
    await openAppWithFallback(appUrl, webUrl(knownPos));
    return knownPos;
  }
  const tab = window.open('', '_blank');
  if (tab) {
    try {
      tab.document.title = '네이버 지도로 이동 중';
      tab.document.body.style.cssText = 'font: 15px/1.5 system-ui, sans-serif; color: #4e5968; padding: 24px;';
      tab.document.body.textContent = '현재 위치를 확인하고 네이버 지도 길찾기로 이동하고 있어요…';
    } catch { /* 빈 탭에 글을 못 써도 괜찮아요 */ }
  }
  let from = knownPos;
  if (!from) {
    try { from = await getUserLocation(); } catch { from = null; }
  }
  const url = webUrl(from);
  if (tab) {
    tab.opener = null;
    tab.location.replace(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  return from;
}

export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('복사하지 못했어요');
}

/** 이 찜질방 상세로 바로 열리는 주소(?place=장소id)를 공유해요. 공유 시트가 없으면 주소를 복사해요. */
export async function sharePlace(id: string, name: string): Promise<'shared' | 'copied'> {
  const url = `${location.origin}${location.pathname}?place=${encodeURIComponent(id)}`;
  if (navigator.share) {
    await navigator.share({ title: name, text: `${name} 요금·후기를 확인해 보세요`, url });
    return 'shared';
  }
  await copyText(url);
  return 'copied';
}

/** 찜 목록 같은 작은 값을 이 기기의 브라우저에 저장해요. 저장소를 못 쓰는 환경이면 조용히 넘어가요. */
export const storage = {
  async get(key: string): Promise<string | null> {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  async set(key: string, value: string): Promise<void> {
    try { localStorage.setItem(key, value); } catch { /* 저장할 수 없는 환경 */ }
  },
};

/** 지원하는 휴대폰에서 아주 짧게 진동해요. */
export function haptic() {
  try { navigator.vibrate?.(8); } catch { /* 지원하지 않으면 무시 */ }
}

/** 공유 주소(?place=장소id)나 #장소id 로 들어왔을 때 열 찜질방 id */
export function initialPlaceId(): string | null {
  const fromQuery = new URLSearchParams(location.search).get('place');
  if (fromQuery && /^[a-z0-9-]+$/.test(fromQuery)) return fromQuery;
  const fromHash = decodeURIComponent(location.hash.replace(/^#/, ''));
  return /^[a-z0-9-]+$/.test(fromHash) ? fromHash : null;
}
