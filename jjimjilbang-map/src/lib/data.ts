// 찜질방 데이터 읽기·가공 (data/*.json 을 그대로 import 해요)
import placesJson from '../../data/places.json';
import naverJson from '../../data/naver-content.json';
import youtubeJson from '../../data/youtube-content.json';
import facilitiesJson from '../../data/facilities.json';
import type { LatLng } from './map/types';

export type PriceType = '찜질' | '목욕' | '기타';

export interface PriceRow {
  type: PriceType;
  label: string;
  who: string;
  days: string;
  time: string | null;
  price: number;
  note?: string;
}

/** 후기가 올라온 곳: 유튜브, 인스타그램, 그 밖의 웹(블로그·기사·여행 가이드·스레드) */
export type ReviewPlatform = 'youtube' | 'instagram' | 'web';
/** 추천 / 장단점(보통) / 아쉬움. 판단할 근거가 없으면 null */
export type Verdict = 'recommend' | 'mixed' | 'negative';

export interface ReviewLink {
  title: string;
  url: string;
  /** 사이트·매체 이름 (예: 다음 뉴스, 트립닷컴) */
  source?: string;
  /** YYYY, YYYY-MM, YYYY-MM-DD */
  date?: string | null;
  /** 없으면 주소로 판단해요 */
  platform?: ReviewPlatform;
  /** list = 여러 곳을 묶어 추천한 글·영상 */
  kind?: 'review' | 'list';
  /** 채널·계정·필자 */
  author?: string | null;
  verdict?: Verdict | null;
  /** 이 장소에 대해 한 말을 직접 요약한 한 줄 */
  note?: string | null;
  /** 협찬·광고 표시가 있으면 true */
  sponsored?: boolean;
}
/** 장소의 인스타그램 페이지 (개별 게시물은 reviewLinks 에 platform: 'instagram' 으로) */
export interface InstagramInfo {
  /** 이 장소를 태그한 게시물 모음 (instagram.com/explore/locations/숫자/…) */
  location?: { url: string; posts?: number | null; checkedAt?: string | null } | null;
  /** 업체 공식 계정 */
  account?: { url: string; handle: string; followers?: number | null } | null;
}

export interface Photo { url: string; credit?: string; caption?: string }
export interface Schedule { open: string; close: string; days?: number[]; note?: string }
export interface RegularClosing { weekday: number; nth: number; label?: string }

export interface RawPlace {
  id: string;
  name: string;
  nameEn?: string | null;
  aliases?: string[];
  category?: string;
  gu: string;
  address?: string | null;
  station?: string | null;
  lat: number;
  lng: number;
  coordsApprox?: boolean;
  phone?: string | null;
  open24h: boolean;
  hours?: string | null;
  schedule?: Schedule | null;
  closed?: RegularClosing[];
  gender: 'all' | 'female' | 'male';
  prices: PriceRow[];
  includes?: string[];
  extraFees?: { label: string; price: number | string }[];
  priceSource?: { url: string; label?: string; date?: string | null } | null;
  priceNote?: string | null;
  alert?: string | null;
  facilities: string[];
  facilityNotes?: string | null;
  highlights?: string[];
  cons?: string[];
  hashtags?: string[];
  reviewLinks?: ReviewLink[];
  instagram?: InstagramInfo | null;
  photos?: Photo[];
  naverPlaceId?: string | null;
  naverQuery?: string;
  /** 같은 이름의 다른 지점 글·사진을 거르는 단어 (예: "문래") */
  naverExclude?: string[];
  verifiedAt?: string;
  confidence?: 'high' | 'medium' | 'low';
  operatingEvidence?: string | null;
}

export interface Place extends RawPlace {
  index: number;
  aliases: string[];
  highlights: string[];
  cons: string[];
  hashtags: string[];
  reviewLinks: ReviewLink[];
  priceRows: PriceRow[];
  minPrice: number | null;
  haystack: string;
  reviews: ReviewSummary;
}

export interface ReviewSummary {
  /** 모은 후기·추천 글·영상 수 */
  total: number;
  recommend: number;
  mixed: number;
  negative: number;
  byPlatform: Record<ReviewPlatform, { total: number; recommend: number }>;
  /** 인스타그램 위치 태그 게시물 수 (모르면 null) */
  instaTagged: number | null;
  /** 추천순 점수 (아래 reviewScore 설명 참고) */
  score: number;
}

export interface YoutubeVideo {
  url: string;
  title: string;
  channel?: string | null;
  publishedAt?: string | null;
  views?: number | null;
}

export interface Facility { label: string; short: string; group: 'heat' | 'bath' | 'rest' | 'amenity'; icon: string }
export interface Facilities {
  groups: { id: Facility['group']; label: string }[];
  items: Record<string, Facility>;
  quickFilters: string[];
  signature: string[];
}

export interface NaverInfo {
  blogTotal?: number;
  blog?: { title: string; link: string; description?: string; bloggername?: string; postdate?: string | null }[];
  images?: { title?: string; link: string; thumbnail: string }[];
}

export const FACILITIES = facilitiesJson as unknown as Facilities;
const NAVER = naverJson as unknown as { updatedAt: string | null; byPlace: Record<string, NaverInfo> };
const YOUTUBE = youtubeJson as unknown as {
  updatedAt: string | null;
  byPlace: Record<string, YoutubeVideo[]>;
  /** reviewLinks 에 넣은 추천 영상의 채널·날짜·조회수 (scripts/fetch-youtube.mjs 가 채워요) */
  videos?: Record<string, { channel?: string | null; publishedAt?: string | null; views?: number | null }>;
  /** 지워졌거나 비공개가 된 영상 id */
  unavailable?: string[];
};
const UNAVAILABLE = new Set(YOUTUBE.unavailable ?? []);
export const youtubeId = (url: string) => (/youtu/.test(url) ? /(?:youtu\.be\/|[?&]v=|\/shorts\/)([\w-]{11})/.exec(url)?.[1] ?? null : null);

// 유튜브 링크에 비어 있는 채널·날짜를 API로 확인한 값으로 채우고, 볼 수 없게 된 영상은 빼요.
function withYoutubeInfo(links: ReviewLink[]): ReviewLink[] {
  return links.flatMap((r) => {
    const id = youtubeId(r.url);
    if (!id) return [r];
    if (UNAVAILABLE.has(id)) return [];
    const v = YOUTUBE.videos?.[id];
    if (!v) return [r];
    return [{ ...r, author: r.author ?? v.channel ?? null, date: r.date ?? v.publishedAt ?? null }];
  });
}
export const DATA_UPDATED_AT = (placesJson as { updatedAt: string }).updatedAt;

// ---------------------------------------------------------------- 숫자·문자
export const num = (n: number) => n.toLocaleString('ko-KR');
export const won = (n: number) => num(n) + '원';
export const normText = (s: unknown) => String(s ?? '').toLowerCase().replace(/\s+/g, '');

export function shortWon(n: number) {
  if (n % 1000 !== 0) return num(n);
  if (n < 10000) return n / 1000 + '천';
  return Math.round(n / 1000) / 10 + '만';
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export const fmtDist = (km: number) => (km < 1 ? Math.round(km * 1000) + 'm' : km.toFixed(1) + 'km');

// ---------------------------------------------------------------- 장소 정리
const CHILD_RE = /소인|어린이|아동|청소년|유아|초등|미취학/;
const ADULT_WHO = ['대인', '성인', '공통'];
// who 값이 있으면 그것으로, 없으면 라벨 글자로 어른 요금인지 판단해요.
const isAdult = (r: PriceRow) => (r.who ? ADULT_WHO.includes(r.who) : !CHILD_RE.test(r.label || ''));

// ---------------------------------------------------------------- 후기 평가·추천 점수
export function platformOf(r: ReviewLink): ReviewPlatform {
  if (r.platform) return r.platform;
  let host = '';
  try { host = new URL(r.url).hostname.replace(/^(www|m)\./, ''); } catch { /* 주소가 이상하면 웹으로 */ }
  if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) return 'youtube';
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
  return 'web';
}

/** "2025-08" 같은 날짜가 몇 달 전인지. 날짜가 없으면 null */
export function monthsAgo(date: string | null | undefined, now = new Date()): number | null {
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(date || '');
  if (!m) return null;
  const month = m[2] ? Number(m[2]) : 7; // 연도만 있으면 그해 중간으로 봐요
  return (now.getFullYear() - Number(m[1])) * 12 + (now.getMonth() + 1 - month);
}

const PLATFORM_WEIGHT: Record<ReviewPlatform, number> = { youtube: 1.2, instagram: 1, web: 0.8 };
const VERDICT_POINT: Record<Verdict, number> = { recommend: 1, mixed: 0.3, negative: -1 };
const CONFIDENCE_BONUS = { high: 1, medium: 0.5, low: 0 } as const;
const recency = (months: number | null) => (months == null ? 0.4 : months <= 12 ? 1 : months <= 24 ? 0.8 : months <= 48 ? 0.5 : 0.3);

// 글 수가 많을수록 조금씩 더해요: 10개 0.25, 100개 0.5, 1,000개 0.75, 10,000개 이상 1
const buzz = (count?: number | null) => (count && count > 1 ? Math.min(1, Math.log10(count) / 4) : 0);

/**
 * 추천순 점수
 * = Σ(후기 하나마다: 출처 가중치 × 평가 점수 × 최신성 × 묶음 글 0.8 × 협찬 0.5)
 *   + 정보 신뢰도(높음 1, 보통 0.5, 낮음 0)
 *   + 화제성: 네이버 블로그 글 수(최대 1) + 인스타그램 위치 태그 게시물 수(최대 1)
 * - 출처 가중치: 유튜브 1.2, 인스타그램 1, 블로그·기사 0.8
 * - 평가 점수: 추천 1, 장단점 0.3, 아쉬움 -1, 판단 근거 없음 0.2
 * - 최신성: 1년 안 1, 2년 안 0.8, 4년 안 0.5, 그 전 0.3, 날짜 모름 0.4
 */
function reviewScore(links: ReviewLink[], confidence: RawPlace['confidence'], blogTotal?: number, instaTagged?: number | null) {
  let score = 0;
  for (const r of links) {
    const point = r.verdict ? VERDICT_POINT[r.verdict] : 0.2;
    score += PLATFORM_WEIGHT[platformOf(r)] * point * recency(monthsAgo(r.date))
      * (r.kind === 'list' ? 0.8 : 1) * (r.sponsored ? 0.5 : 1);
  }
  score += CONFIDENCE_BONUS[confidence ?? 'medium'];
  score += buzz(blogTotal) + buzz(instaTagged);
  return Math.round(score * 100) / 100;
}

function summarizeReviews(links: ReviewLink[], confidence: RawPlace['confidence'], blogTotal?: number, instaTagged?: number | null): ReviewSummary {
  const byPlatform: ReviewSummary['byPlatform'] = {
    youtube: { total: 0, recommend: 0 },
    instagram: { total: 0, recommend: 0 },
    web: { total: 0, recommend: 0 },
  };
  let recommend = 0, mixed = 0, negative = 0;
  for (const r of links) {
    const pf = byPlatform[platformOf(r)];
    pf.total++;
    if (r.verdict === 'recommend') { recommend++; pf.recommend++; }
    else if (r.verdict === 'mixed') mixed++;
    else if (r.verdict === 'negative') negative++;
  }
  return {
    total: links.length, recommend, mixed, negative, byPlatform,
    instaTagged: instaTagged ?? null,
    score: reviewScore(links, confidence, blogTotal, instaTagged),
  };
}

function normalize(p: RawPlace, index: number): Place {
  const prices = (p.prices || []).filter((r) => typeof r.price === 'number' && r.price > 0);
  const jjim = prices.filter((r) => (r.type || '찜질') === '찜질' && isAdult(r));
  const base = jjim.length ? jjim : prices.filter(isAdult);
  const reviewLinks = withYoutubeInfo(p.reviewLinks || []);
  return {
    ...p,
    index,
    prices,
    aliases: p.aliases || [],
    facilities: p.facilities || [],
    hashtags: p.hashtags || [],
    highlights: p.highlights || [],
    cons: p.cons || [],
    reviewLinks,
    priceRows: base,
    minPrice: base.length ? Math.min(...base.map((r) => r.price)) : null,
    haystack: normText([p.name, p.nameEn, (p.aliases || []).join(' '), p.gu, p.address, p.station, p.category, (p.hashtags || []).join(' ')].join(' ')),
    reviews: summarizeReviews(reviewLinks, p.confidence, NAVER.byPlace?.[p.id]?.blogTotal, p.instagram?.location?.posts),
  };
}

export const PLACES: Place[] = (placesJson as unknown as { places: RawPlace[] }).places.map(normalize);
export const BY_ID: Record<string, Place> = Object.fromEntries(PLACES.map((p) => [p.id, p]));

export const naverInfo = (p: Place): NaverInfo | null => NAVER.byPlace?.[p.id] ?? null;
export const category = (p: Place) => p.category || '찜질방';

export const youtubeVideos = (p: Place): YoutubeVideo[] => YOUTUBE.byPlace?.[p.id] ?? [];

/** 목록 한 줄에 붙는 짧은 평가: "추천 5" */
export function reviewLabel(p: Place) {
  if (p.reviews.recommend) return '추천 ' + p.reviews.recommend;
  const nv = naverInfo(p);
  if (nv?.blogTotal) return '블로그 리뷰 ' + num(nv.blogTotal);
  return p.reviews.total ? '후기 ' + p.reviews.total : '';
}

/** 유튜브·인스타에서 추천한 곳이면 배지 문구: "유튜브 추천 7" */
export function snsBadge(p: Place): string | null {
  const yt = p.reviews.byPlatform.youtube.recommend;
  const ig = p.reviews.byPlatform.instagram.recommend;
  if (yt && ig) return `유튜브·인스타 추천 ${yt + ig}`;
  if (yt) return `유튜브 추천 ${yt}`;
  if (ig) return `인스타 추천 ${ig}`;
  return null;
}

/** 후기 평가 한 줄 요약 */
export function reviewHeadline(s: ReviewSummary): string {
  const yt = s.byPlatform.youtube.recommend, ig = s.byPlatform.instagram.recommend;
  const where = yt && ig ? '유튜브·인스타그램' : yt ? '유튜브' : '인스타그램';
  if (!s.total) return '아직 모은 후기가 없어요';
  if (s.negative > s.recommend) return '아쉽다는 후기가 더 많아요';
  if (yt + ig >= 3) return `${where}에서 많이 추천했어요`;
  if (yt + ig >= 1) return `${where}에서도 추천했어요`;
  if (s.recommend >= 2) return '블로그·기사에서 추천했어요';
  if (s.recommend === 1) return '추천한 글이 하나 있어요';
  return '평가가 드러난 후기는 아직 적어요';
}

export const PLATFORM_LABEL: Record<ReviewPlatform, string> = { youtube: '유튜브', instagram: '인스타그램', web: '블로그·기사' };
export const VERDICT_LABEL: Record<Verdict, string> = { recommend: '추천', mixed: '장단점', negative: '아쉬움' };

export function photoList(p: Place) {
  // src: 원본(크게 보기용), thumb: 작은 미리보기(원본이 안 열리면 대신 써요)
  if (p.photos?.length) return p.photos.map((ph) => ({ src: ph.url, thumb: ph.url, alt: `${p.name} ${ph.caption || '사진'}`, credit: ph.credit || '', link: null as string | null }));
  const nv = naverInfo(p);
  if (nv?.images?.length) return nv.images.map((im) => ({ src: im.link || im.thumbnail, thumb: im.thumbnail || im.link, alt: im.title || p.name, credit: '', link: im.link }));
  return [];
}

// 사진이 없을 때 대표로 보여줄 시설
export function signature(p: Place, n: number) {
  const first = FACILITIES.signature.filter((k) => p.facilities.includes(k));
  const rest = p.facilities.filter((k) => !first.includes(k) && FACILITIES.items[k]);
  return first.concat(rest).slice(0, n);
}

// ---------------------------------------------------------------- 영업 상태 (한국 시간 기준)
export interface KstNow { wd: number; day: number; minutes: number }

export function kstNow(date = new Date()): KstNow {
  const parts: Record<string, string> = {};
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
    .formatToParts(date).forEach((x) => { parts[x.type] = x.value; });
  return {
    wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday),
    day: Number(parts.day),
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
  };
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const toMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };

export type OpenKey = 'open' | 'closing' | 'closed' | 'unknown';
export interface OpenStatus { key: OpenKey; text: string; sub: string }

export function openStatus(p: Place, now: KstNow = kstNow()): OpenStatus {
  const hol = (p.closed || []).find((c) => c.weekday === now.wd && Math.ceil(now.day / 7) === c.nth);
  if (hol) return { key: 'closed', text: '오늘 휴무', sub: `${hol.label || '정기'} 휴무` };
  if (p.open24h) return { key: 'open', text: '영업 중', sub: '24시간 영업' };
  const s = p.schedule;
  if (!s) return { key: 'unknown', text: '영업시간 확인 필요', sub: '' };
  if (s.days && !s.days.includes(now.wd)) {
    return { key: 'closed', text: '오늘 휴무', sub: s.note || s.days.map((d) => WEEK[d]).join('·') + '요일만 운영' };
  }
  const o = toMin(s.open), c = toMin(s.close), m = now.minutes;
  const isOpen = c > o ? m >= o && m < c : m >= o || m < c;
  if (isOpen) {
    const left = (c - m + 1440) % 1440;
    return left <= 60
      ? { key: 'closing', text: '곧 영업 종료', sub: `${s.close}에 영업 종료` }
      : { key: 'open', text: '영업 중', sub: `${s.close}에 영업 종료` };
  }
  return { key: 'closed', text: m < o ? '영업 전' : '영업 종료', sub: `${s.open}에 영업 시작` };
}

// ---------------------------------------------------------------- 필터·정렬
export type SortKey = 'rec' | 'price' | 'near';
export const SORT_LABELS: Record<SortKey, string> = { rec: '추천순', price: '낮은 요금순', near: '가까운순' };

export interface FilterState {
  q: string;
  chips: Set<string>;
  favs: Set<string>;
  /** 내 기록이 있는 장소 id */
  visited?: Set<string>;
  sort: SortKey;
  userPos: { lat: number; lng: number } | null;
}

export function filterPlaces(f: FilterState, now: KstNow = kstNow()): Place[] {
  const q = normText(f.q);
  const list = PLACES.filter((p) => {
    if (q && !p.haystack.includes(q)) return false;
    for (const c of f.chips) {
      if (c === 'fav') { if (!f.favs.has(p.id)) return false; }
      else if (c === 'visited') { if (!f.visited?.has(p.id)) return false; }
      else if (c === 'open') { const k = openStatus(p, now).key; if (k !== 'open' && k !== 'closing') return false; }
      else if (c === 'open24h') { if (!p.open24h) return false; }
      else if (c === 'female') { if (p.gender !== 'female') return false; }
      else if (c === 'under15k') { if (!(p.minPrice && p.minPrice <= 15000)) return false; }
      else if (c === 'sns') { if (!snsBadge(p)) return false; }
      else if (!p.facilities.includes(c)) return false;
    }
    return true;
  });
  const byRec = (a: Place, b: Place) => b.reviews.score - a.reviews.score || a.index - b.index;
  if (f.sort === 'price') list.sort((a, b) => (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity) || byRec(a, b));
  else if (f.sort === 'near' && f.userPos) list.sort((a, b) => distanceKm(f.userPos!, a) - distanceKm(f.userPos!, b));
  else list.sort(byRec);
  return list;
}

// ---------------------------------------------------------------- 바깥 링크
export function naverPlaceUrl(p: Place, tab?: string) {
  if (p.naverPlaceId) return `https://m.place.naver.com/place/${encodeURIComponent(p.naverPlaceId)}/${tab || 'home'}`;
  return 'https://map.naver.com/p/search/' + encodeURIComponent(p.naverQuery || p.name);
}
export const naverBlogSearchUrl = (p: Place) => 'https://search.naver.com/search.naver?where=blog&query=' + encodeURIComponent((p.naverQuery || p.name) + ' 후기');
export const instaTagUrl = (tag: string) => 'https://www.instagram.com/explore/tags/' + encodeURIComponent(tag.replace(/^#/, '')) + '/';
export const youtubeSearchUrl = (p: Place) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent((p.naverQuery || p.name) + ' 찜질방');

// 네이버 지도 앱 URL Scheme의 appname(필수): 웹에서 부를 때는 웹 페이지 주소를 넣어요.
const naverAppName = () => (typeof location !== 'undefined' ? location.origin : 'seoul-jjimjilbang-map');

/**
 * 네이버 지도 앱에서 이 찜질방까지 길찾기를 바로 여는 주소.
 * 출발지(slat·slng)를 비우면 네이버 지도 앱이 현재 위치에서 출발해요.
 * mode: public 대중교통, car 자동차, walk 도보
 */
export function naverRouteScheme(p: Place, mode: 'public' | 'car' | 'walk' = 'public') {
  return `nmap://route/${mode}?dlat=${p.lat}&dlng=${p.lng}&dname=${encodeURIComponent(p.name)}&appname=${encodeURIComponent(naverAppName())}`;
}

// 위도·경도(WGS84) → 네이버 지도 웹 주소가 쓰는 웹 메르카토르(EPSG:3857) 좌표
function toWebMercator(lat: number, lng: number) {
  const R = 6378137;
  return {
    x: (lng * Math.PI / 180) * R,
    y: Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * R,
  };
}

// 길찾기 주소의 지점 하나: x,y,이름,장소ID,종류 (장소 ID가 없으면 좌표 지점으로)
function naverWebPoint(lat: number, lng: number, name: string, placeId?: string | null) {
  const { x, y } = toWebMercator(lat, lng);
  return [x.toFixed(6), y.toFixed(6), encodeURIComponent(name), placeId ? encodeURIComponent(placeId) : '', placeId ? 'PLACE_POI' : 'ADDRESS_POI'].join(',');
}

/**
 * 네이버 지도 웹(map.naver.com) 길찾기 주소: /p/directions/{출발}/{도착}/{경유}/{수단}
 * from 을 넘기면 그 위치("내 위치")에서 출발하고, 없으면 출발지를 비워 둬요(-).
 */
export function naverRouteWebUrl(p: Place, from?: LatLng | null, mode: 'transit' | 'car' | 'walk' = 'transit') {
  const start = from ? naverWebPoint(from.lat, from.lng, '내 위치') : '-';
  const goal = naverWebPoint(p.lat, p.lng, p.name, p.naverPlaceId);
  return `https://map.naver.com/p/directions/${start}/${goal}/-/${mode}`;
}
