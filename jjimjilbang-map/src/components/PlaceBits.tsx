// 목록·지도·상세에서 같이 쓰는 작은 조각들
import { Badge, ListRow } from '../ui';
import { colors } from '../ui';
import { useApp } from '../AppContext';
import { myRating } from '../lib/visits';
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
  snsBadge,
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
  // 유튜브·인스타 추천 배지가 붙는 곳은 배지에 추천 수가 있으니 여기서는 빼요.
  const review = withReview && !snsBadge(place) ? reviewLabel(place) : '';
  const rest = [st.sub, review, withDistance && userPos ? fmtDist(distanceKm(userPos, place)) : '']
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

/** 목록 한 줄: 이름 / 영업 상태 / (추천 배지) 동네·역 — 줄 수와 높이를 항상 같게 맞춰요 */
export function PlaceRow({ place, onClick }: { place: Place; onClick: () => void; withReview?: boolean }) {
  const { visits } = useApp();
  const mine = myRating(visits[place.id]);
  const cat = category(place);
  const where = [cat !== '찜질방' ? cat : '', place.gu, shortStation(place.station)].filter(Boolean).join(' · ');
  const badge = snsBadge(place);
  const rec = !badge && place.reviews.recommend ? `추천 ${place.reviews.recommend}` : '';
  return (
    <ListRow
      onClick={onClick}
      withTouchEffect
      verticalPadding="medium"
      left={<PlaceThumb place={place} />}
      contents={
        <ListRow.Texts
          type="3RowTypeA"
          top={<span className="row-line row-name">{place.name}</span>}
          middle={<span className="row-line"><StatusText place={place} withReview={false} withDistance /></span>}
          bottom={
            <span className="row-line row-meta">
              {mine !== null && <span className="row-mine" aria-label={`내 별점 ${mine}점`}>★ {mine}</span>}
              {badge && <Badge size="xsmall" variant="weak" color="red">{badge}</Badge>}
              {rec && <span className="row-rec">{rec}</span>}
              <span className="row-where">{where}</span>
            </span>
          }
        />
      }
      right={<PriceTag place={place} />}
    />
  );
}

// 핀 아이콘은 SVG로 그려요 (♨ 같은 기호 문자는 기기마다 컬러 이모지로 바뀌어요)
const STEAM_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M8 3.5c-1.3 1.6 1.3 2.6 0 4.2s1.3 2.6 0 4.2M12 3c-1.3 1.6 1.3 2.6 0 4.2s1.3 2.6 0 4.2M16 3.5c-1.3 1.6 1.3 2.6 0 4.2s1.3 2.6 0 4.2"/><path d="M4.5 15.5c1.8 3.6 13.2 3.6 15 0"/></svg>';
const HEART_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12 20s-7-4.4-9-9.1C1.8 7.6 4 4.5 7.3 4.5c2 0 3.4 1.1 4.7 2.8 1.3-1.7 2.7-2.8 4.7-2.8 3.3 0 5.5 3.1 4.3 6.4C19 15.6 12 20 12 20z"/></svg>';

/**
 * 지도 핀 HTML (지도 어댑터가 DOM으로 넣어요).
 * groupCount 가 2 이상이면 가까이 겹친 핀들을 대표하는 핀이에요: 오른쪽 위에 "+N" 을 달아요.
 */
export function pinHtml(p: Place, selected: boolean, groupCount: number, fav: boolean) {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
  const price = p.minPrice ? shortWon(p.minPrice) : '확인 중';
  const more = groupCount > 1 ? groupCount - 1 : 0;
  const label = `${p.name}, ${p.minPrice ? won(p.minPrice) + '부터' : '요금 확인 중'}${more ? `, 근처 ${more}곳 더 있음. 누르면 펼쳐요` : ''}`;
  const female = p.gender === 'female';
  const mark = fav ? HEART_SVG : STEAM_SVG;
  return `<button type="button" class="pin${selected ? ' is-selected' : ''}${female ? ' is-female' : ''}${more ? ' is-group' : ''}" aria-label="${esc(label)}">` +
    `<span class="pin-dot" aria-hidden="true">${mark}</span>` +
    (female ? '<span class="pin-tag">여성</span>' : '') +
    `<span class="pin-price">${esc(price)}</span>` +
    (more ? `<span class="pin-count" aria-hidden="true">+${more}</span>` : '') +
    `</button>` +
    `<span class="pin-label" aria-hidden="true">${esc(p.name)}${more ? ` 외 ${more}곳` : ''}</span>`;
}
