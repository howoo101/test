// 목록·지도·상세에서 같이 쓰는 작은 조각들
import { ListRow } from '@toss/tds-mobile';
import { colors } from '@toss/tds-colors';
import { useApp } from '../AppContext';
import {
  FACILITIES,
  category,
  distanceKm,
  fmtDist,
  openStatus,
  photoList,
  reviewLabel,
  shortWon,
  signature,
  won,
  type OpenKey,
  type Place,
} from '../lib/data';

const STATUS_COLOR: Record<OpenKey, string> = {
  open: colors.green600,
  closing: colors.red500,
  closed: colors.red500,
  unknown: colors.grey500,
};

/** "영업 중 · 24시간 영업 · 후기 3" */
export function StatusText({ place, withReview = true, withDistance = false }: { place: Place; withReview?: boolean; withDistance?: boolean }) {
  const { userPos } = useApp();
  const st = openStatus(place);
  const rest = [st.sub, withReview ? reviewLabel(place) : '', withDistance && userPos ? fmtDist(distanceKm(userPos, place)) : '']
    .filter(Boolean)
    .join(' · ');
  return (
    <span className="status-text">
      <b style={{ color: STATUS_COLOR[st.key] }}>{st.text}</b>
      {rest && <span className="status-rest"> · {rest}</span>}
    </span>
  );
}

/** 사진이 있으면 사진, 없으면 대표 시설 아이콘 타일 */
export function PlaceThumb({ place, size = 56 }: { place: Place; size?: number }) {
  const photo = photoList(place)[0];
  if (photo) {
    return (
      <span className="thumb" style={{ width: size, height: size }}>
        <img src={photo.src} alt="" loading="lazy" referrerPolicy="no-referrer" />
      </span>
    );
  }
  const k = signature(place, 1)[0];
  const f = k ? FACILITIES.items[k] : null;
  return (
    <span className={`thumb tone-${f?.group ?? 'amenity'}`} style={{ width: size, height: size }} aria-hidden="true">
      <span className="thumb-ico">{f?.icon ?? '♨'}</span>
    </span>
  );
}

/** 오른쪽 요금 표시: "1.4만원" + "주간" 처럼 */
export function PriceTag({ place }: { place: Place }) {
  if (!place.minPrice) {
    return <ListRow.Text typography="t7" color={colors.grey500}>요금 확인 중</ListRow.Text>;
  }
  const row = place.priceRows.find((r) => r.price === place.minPrice);
  const label = [row?.label, row?.days && row.days !== '전체' ? row.days.replace('주말·공휴일', '주말') : ''].filter(Boolean).join(' ');
  return (
    <span className="price-tag">
      <ListRow.Text typography="t5" fontWeight="bold" color={colors.grey900}>{shortWon(place.minPrice)}원</ListRow.Text>
      <ListRow.Text typography="t7" color={colors.grey500}>{label || '어른'}</ListRow.Text>
    </span>
  );
}

// "선릉역 8번 출구 도보 3분" -> "선릉역"
const shortStation = (s?: string | null) => (s ? /[가-힣A-Za-z0-9]+역/.exec(s)?.[0] ?? null : null);

/** 목록 한 줄 */
export function PlaceRow({ place, onClick, withReview = true }: { place: Place; onClick: () => void; withReview?: boolean }) {
  const meta = [category(place), place.gu, shortStation(place.station)].filter(Boolean).join(' · ');
  return (
    <ListRow
      onClick={onClick}
      withTouchEffect
      verticalPadding="large"
      left={<PlaceThumb place={place} />}
      contents={
        <ListRow.Texts
          type="3RowTypeA"
          top={place.name}
          middle={<StatusText place={place} withReview={withReview} withDistance />}
          bottom={meta}
        />
      }
      right={<PriceTag place={place} />}
    />
  );
}

// 핀 아이콘은 SVG로 그려요 (♨ 같은 기호 문자는 기기마다 컬러 이모지로 바뀌어요)
const STEAM_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M8 3.5c-1.3 1.6 1.3 2.6 0 4.2s1.3 2.6 0 4.2M12 3c-1.3 1.6 1.3 2.6 0 4.2s1.3 2.6 0 4.2M16 3.5c-1.3 1.6 1.3 2.6 0 4.2s1.3 2.6 0 4.2"/><path d="M4.5 15.5c1.8 3.6 13.2 3.6 15 0"/></svg>';
const HEART_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12 20s-7-4.4-9-9.1C1.8 7.6 4 4.5 7.3 4.5c2 0 3.4 1.1 4.7 2.8 1.3-1.7 2.7-2.8 4.7-2.8 3.3 0 5.5 3.1 4.3 6.4C19 15.6 12 20 12 20z"/></svg>';

/** 지도 핀 HTML (지도 어댑터가 DOM으로 넣어요) */
export function pinHtml(p: Place, selected: boolean, compact: boolean, fav: boolean) {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
  const price = p.minPrice ? shortWon(p.minPrice) : '확인 중';
  const label = `${p.name}, ${p.minPrice ? won(p.minPrice) + '부터' : '요금 확인 중'}`;
  const female = p.gender === 'female';
  const mark = fav ? HEART_SVG : STEAM_SVG;
  if (compact && !selected) {
    return `<button type="button" class="pin is-compact${female ? ' is-female' : ''}" aria-label="${esc(label)}"><span class="pin-dot" aria-hidden="true">${mark}</span></button>`;
  }
  return `<button type="button" class="pin${selected ? ' is-selected' : ''}${female ? ' is-female' : ''}" aria-label="${esc(label)}">` +
    `<span class="pin-dot" aria-hidden="true">${mark}</span>` +
    (female ? '<span class="pin-tag">여성</span>' : '') +
    `<span class="pin-price">${esc(price)}</span></button>` +
    `<span class="pin-label" aria-hidden="true">${esc(p.name)}</span>`;
}
