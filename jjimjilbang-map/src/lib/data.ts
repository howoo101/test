// 찜질방 데이터 읽기·가공 (data/*.json 을 그대로 import 해요)
import placesJson from '../../data/places.json';
import naverJson from '../../data/naver-content.json';
import facilitiesJson from '../../data/facilities.json';

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

export interface ReviewLink { title: string; url: string; source?: string; date?: string | null }
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
  instagramPosts?: string[];
  photos?: Photo[];
  naverPlaceId?: string | null;
  naverQuery?: string;
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

function normalize(p: RawPlace, index: number): Place {
  const prices = (p.prices || []).filter((r) => typeof r.price === 'number' && r.price > 0);
  const jjim = prices.filter((r) => (r.type || '찜질') === '찜질' && isAdult(r));
  const base = jjim.length ? jjim : prices.filter(isAdult);
  return {
    ...p,
    index,
    prices,
    aliases: p.aliases || [],
    facilities: p.facilities || [],
    hashtags: p.hashtags || [],
    highlights: p.highlights || [],
    cons: p.cons || [],
    reviewLinks: p.reviewLinks || [],
    priceRows: base,
    minPrice: base.length ? Math.min(...base.map((r) => r.price)) : null,
    haystack: normText([p.name, p.nameEn, (p.aliases || []).join(' '), p.gu, p.address, p.station, p.category, (p.hashtags || []).join(' ')].join(' ')),
  };
}

export const PLACES: Place[] = (placesJson as unknown as { places: RawPlace[] }).places.map(normalize);
export const BY_ID: Record<string, Place> = Object.fromEntries(PLACES.map((p) => [p.id, p]));

export const naverInfo = (p: Place): NaverInfo | null => NAVER.byPlace?.[p.id] ?? null;
export const category = (p: Place) => p.category || '찜질방';

export function reviewLabel(p: Place) {
  const nv = naverInfo(p);
  if (nv?.blogTotal) return '블로그 리뷰 ' + num(nv.blogTotal);
  return p.reviewLinks.length ? '후기 ' + p.reviewLinks.length : '';
}

export function photoList(p: Place) {
  if (p.photos?.length) return p.photos.map((ph) => ({ src: ph.url, alt: `${p.name} ${ph.caption || '사진'}`, credit: ph.credit || '', link: null as string | null }));
  const nv = naverInfo(p);
  if (nv?.images?.length) return nv.images.map((im) => ({ src: im.thumbnail, alt: im.title || p.name, credit: '', link: im.link }));
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
  sort: SortKey;
  userPos: { lat: number; lng: number } | null;
}

export function filterPlaces(f: FilterState, now: KstNow = kstNow()): Place[] {
  const q = normText(f.q);
  const list = PLACES.filter((p) => {
    if (q && !p.haystack.includes(q)) return false;
    for (const c of f.chips) {
      if (c === 'fav') { if (!f.favs.has(p.id)) return false; }
      else if (c === 'open') { const k = openStatus(p, now).key; if (k !== 'open' && k !== 'closing') return false; }
      else if (c === 'open24h') { if (!p.open24h) return false; }
      else if (c === 'female') { if (p.gender !== 'female') return false; }
      else if (c === 'under15k') { if (!(p.minPrice && p.minPrice <= 15000)) return false; }
      else if (!p.facilities.includes(c)) return false;
    }
    return true;
  });
  const byIndex = (a: Place, b: Place) => a.index - b.index;
  if (f.sort === 'price') list.sort((a, b) => (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity) || byIndex(a, b));
  else if (f.sort === 'near' && f.userPos) list.sort((a, b) => distanceKm(f.userPos!, a) - distanceKm(f.userPos!, b));
  else list.sort(byIndex);
  return list;
}

// ---------------------------------------------------------------- 바깥 링크
export function naverPlaceUrl(p: Place, tab?: string) {
  if (p.naverPlaceId) return `https://m.place.naver.com/place/${encodeURIComponent(p.naverPlaceId)}/${tab || 'home'}`;
  return 'https://map.naver.com/p/search/' + encodeURIComponent(p.naverQuery || p.name);
}
export const naverBlogSearchUrl = (p: Place) => 'https://search.naver.com/search.naver?where=blog&query=' + encodeURIComponent((p.naverQuery || p.name) + ' 후기');
export const instaTagUrl = (tag: string) => 'https://www.instagram.com/explore/tags/' + encodeURIComponent(tag.replace(/^#/, '')) + '/';
