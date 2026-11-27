import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import {
  BottomSheet,
  Button,
  Chip,
  ChipItem,
  List,
  ListHeader,
  Paragraph,
  SearchField,
  Top,
} from '../ui';
import { colors } from '../ui';
import { useApp } from '../AppContext';
import { MapView } from '../components/MapView';
import { PlaceRow } from '../components/PlaceBits';
import { DATA_UPDATED_AT, FACILITIES, GU_OPTIONS, LINE_OPTIONS, PLACES, SORT_LABELS, filterPlaces, type SortKey } from '../lib/data';
import { LINE_COLORS, type Line } from '../lib/lines';

type Sheet = 'peek' | 'half' | 'full';

const CHIPS: { id: string; label: string }[] = [
  { id: 'open', label: '영업 중' },
  { id: 'sns', label: '유튜브·인스타 추천' },
  { id: 'open24h', label: '24시간' },
  { id: 'under15k', label: '1.5만원 이하' },
  { id: 'nyj', label: '남양주' },
  { id: 'fav', label: '찜한 곳' },
  { id: 'visited', label: '다녀온 곳' },
  { id: 'female', label: '여성전용' },
  ...FACILITIES.quickFilters.map((k) => ({ id: k, label: FACILITIES.items[k].short })),
];

export function HomePage({ onOpen, active, wide = false, openId = null, detail = null }: {
  onOpen: (id: string) => void;
  active: boolean;
  /** 넓은 화면: 왼쪽 목록(+상세) · 오른쪽 지도 */
  wide?: boolean;
  /** 넓은 화면에서 지금 상세가 열린 장소 */
  openId?: string | null;
  detail?: ReactNode;
}) {
  const { favs, userPos, locate, visits } = useApp();
  const visited = useMemo(() => new Set(Object.keys(visits)), [visits]);
  const [q, setQ] = useState('');
  const [chips, setChips] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortKey>('rec');
  const [gu, setGu] = useState<string | null>(null);
  const [line, setLine] = useState<Line | null>(null);
  const [picker, setPicker] = useState<'gu' | 'line' | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ---- 휴대폰: 지도는 화면 전체, 위에 검색창, 아래에서 끌어올리는 목록 시트 (네이버 지도 앱처럼)
  const [sheet, setSheet] = useState<Sheet>('half');
  const [dragH, setDragH] = useState<number | null>(null);
  const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));
  const [topH, setTopH] = useState(112);
  const topRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = () => setVh(window.innerHeight);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  useLayoutEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const measure = () => setTopH(Math.round(el.getBoundingClientRect().bottom));
    measure();
    const ro = 'ResizeObserver' in window ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [wide]);
  const SHEET_H: Record<Sheet, number> = { peek: 88, half: Math.round(vh * 0.44), full: Math.max(240, vh - topH - 4) };
  const sheetH = dragH ?? SHEET_H[sheet];
  const drag = useRef<{ y: number; h: number; moved: boolean; t: number } | null>(null);
  const onSheetDown = (e: RPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    drag.current = { y: e.clientY, h: sheetH, moved: false, t: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onSheetMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (Math.abs(dy) > 4) d.moved = true;
    if (d.moved) setDragH(Math.min(SHEET_H.full, Math.max(SHEET_H.peek, d.h + dy)));
  };
  const onSheetUp = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const order: Sheet[] = ['peek', 'half', 'full'];
    if (!d.moved) {
      // 손잡이를 톡 누르면 한 단계씩 올리고, 맨 위에서는 반으로 내려요
      setSheet((s) => (s === 'full' ? 'half' : order[order.indexOf(s) + 1]));
      setDragH(null);
      return;
    }
    const h = d.h + (d.y - e.clientY);
    const fast = (d.y - e.clientY) / Math.max(1, performance.now() - d.t); // px/ms, 위로 빠르게 밀면 +
    let next: Sheet = order.reduce((a, b) => (Math.abs(SHEET_H[b] - h) < Math.abs(SHEET_H[a] - h) ? b : a), 'half' as Sheet);
    if (fast > 0.6) next = order[Math.min(2, order.indexOf(sheet) + 1)];
    if (fast < -0.6) next = order[Math.max(0, order.indexOf(sheet) - 1)];
    setSheet(next);
    setDragH(null);
  };
  // 핀을 고르면 시트를 내려서 장소 카드가 보이게 해요
  const selectOnMap = (id: string | null) => {
    setSelectedId(id);
    if (id) setSheet('peek');
  };
  useEffect(() => { if (sheet !== 'full') listRef.current?.scrollTo({ top: 0 }); }, [sheet]);

  const places = useMemo(() => filterPlaces({ q, chips, favs, visited, gu, line, sort, userPos }), [q, chips, favs, visited, gu, line, sort, userPos]);
  const fitKey = `${q}|${[...chips].sort().join(',')}|${gu}|${line}`;

  const toggleChip = (id: string) => {
    setChips((prev) => {
      if (id === 'all') return new Set();
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const changeSort = async (next: SortKey) => {
    setSortOpen(false);
    if (next === 'near' && !userPos) {
      const pos = await locate();
      if (!pos) return;
    }
    setSort(next);
  };

  const resetFilters = () => { setQ(''); setChips(new Set()); setGu(null); setLine(null); };

  // 맨 앞의 "지역"·"지하철"은 눌러서 고르는 버튼이에요 (고르면 이름이 보이고, 다시 눌러 바꾸거나 "전체"로 풀어요)
  const chipRow = (
    <div className="chip-row">
      <Chip kind="select" size="medium">
        <ChipItem selected={chips.size === 0 && !gu && !line} onClick={() => { toggleChip('all'); setGu(null); setLine(null); }}>전체</ChipItem>
        <ChipItem selected={!!gu} onClick={() => setPicker('gu')}>
          <span className="pick-chip">{gu ?? '지역'}<Caret /></span>
        </ChipItem>
        <ChipItem selected={!!line} onClick={() => setPicker('line')}>
          <span className="pick-chip">
            {line && <i className="line-dot" style={{ background: LINE_COLORS[line] }} aria-hidden="true" />}
            {line ?? '지하철'}<Caret />
          </span>
        </ChipItem>
        {CHIPS.map((c) => (
          <ChipItem key={c.id} selected={chips.has(c.id)} onClick={() => toggleChip(c.id)}>{c.label}</ChipItem>
        ))}
      </Chip>
    </div>
  );
  const pickerEl = (
    <BottomSheet
      open={!!picker}
      onClose={() => setPicker(null)}
      header={<BottomSheet.Header>{picker === 'line' ? '지하철 노선' : '지역'}</BottomSheet.Header>}
    >
      {picker === 'gu' && (
        <BottomSheet.Select
          options={[{ name: `전체 · ${PLACES.length}곳`, value: '' }, ...GU_OPTIONS.map((o) => ({ name: `${o.name} · ${o.n}곳`, value: o.name }))]}
          value={gu ?? ''}
          onChange={(e) => { setGu(e.target.value || null); setPicker(null); }}
        />
      )}
      {picker === 'line' && (
        <BottomSheet.Select
          options={[{ name: '전체', value: '' }, ...LINE_OPTIONS.map((o) => ({ name: `${o.name} · ${o.n}곳`, value: o.name }))]}
          value={line ?? ''}
          onChange={(e) => { setLine((e.target.value || null) as Line | null); setPicker(null); }}
        />
      )}
      {picker === 'line' && <p className="picker-note">찜질방 정보에 적힌 가까운 역을 기준으로 골라요. 가까운 역이 적혀 있지 않은 곳은 빠질 수 있어요.</p>}
    </BottomSheet>
  );

  const headEl = (
        <header className="home-head">
          {wide && (
            <Top
              title={<Top.TitleParagraph size={22}>서울·남양주 찜질방, 요금부터 비교해요</Top.TitleParagraph>}
              subtitleBottom={<Top.SubtitleParagraph size={15}>{`${PLACES.length}곳의 요금·시설·후기를 한곳에 모았어요`}</Top.SubtitleParagraph>}
            />
          )}
          <SearchField
            placeholder="찜질방, 동네, 역 이름으로 찾기"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onDeleteClick={() => setQ('')}
            aria-label="찜질방 검색"
          />
          {chipRow}
        </header>
  );
  const mapEl = (
        <div className="home-map">
          <MapView
            places={places}
            selectedId={wide ? openId : selectedId && places.some((p) => p.id === selectedId) ? selectedId : null}
            onSelect={wide ? (id) => { if (id) onOpen(id); } : selectOnMap}
            card={!wide && sheet === 'peek'}
          insets={wide ? undefined : { top: topH, bottom: sheet === 'full' ? 0 : SHEET_H[sheet] }}
            onOpen={onOpen}
            active={active}
            fitKey={fitKey}
          />
        </div>
  );
  const listEl = (
        <section className="home-list">
          <ListHeader
            title={<ListHeader.TitleParagraph fontWeight="bold">{`찜질방 ${places.length}곳`}</ListHeader.TitleParagraph>}
            description={sort === 'rec'
              ? <ListHeader.DescriptionParagraph>유튜브·인스타·블로그 추천과 후기 평가를 합친 순서예요</ListHeader.DescriptionParagraph>
              : undefined}
            descriptionPosition="bottom"
            right={
              <button type="button" className="sort-btn" onClick={() => setSortOpen(true)} aria-haspopup="dialog">
                <ListHeader.RightArrow>{SORT_LABELS[sort]}</ListHeader.RightArrow>
              </button>
            }
          />
          {places.length ? (
            <List>
              {places.map((p) => <PlaceRow key={p.id} place={p} current={wide && p.id === openId} onClick={() => onOpen(p.id)} />)}
            </List>
          ) : (
            <div className="empty pad">
              {chips.has('visited') && !visited.size ? (
                <>
                  <Paragraph.Text typography="t5" fontWeight="bold" color={colors.grey800}>아직 남긴 기록이 없어요</Paragraph.Text>
                  <Paragraph.Text typography="t6" color={colors.grey600}>찜질방 상세에서 "기록 남기기"를 누르면 별점과 메모가 여기 모여요.</Paragraph.Text>
                </>
              ) : (
                <>
                  <Paragraph.Text typography="t5" fontWeight="bold" color={colors.grey800}>조건에 맞는 찜질방이 없어요</Paragraph.Text>
                  <Paragraph.Text typography="t6" color={colors.grey600}>필터를 줄여서 다시 찾아보세요.</Paragraph.Text>
                </>
              )}
              <Button size="medium" variant="weak" onClick={resetFilters}>필터 초기화</Button>
            </div>
          )}
          <p className="fineprint pad">
            {`요금은 ${DATA_UPDATED_AT.slice(0, 7).replace('-', '년 ')}월까지 모은 공개 자료 기준이에요. 방문 전에 한 번 더 확인해 주세요.`}
          </p>
        </section>
  );
  const sheetEl = (
    <>

        <BottomSheet
          open={sortOpen}
          onClose={() => setSortOpen(false)}
          header={<BottomSheet.Header>정렬</BottomSheet.Header>}
        >
          <BottomSheet.Select
            options={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({ name: SORT_LABELS[k], value: k }))}
            value={sort}
            onChange={(e) => changeSort(e.target.value as SortKey)}
          />
        </BottomSheet>
    </>
  );

  if (wide) {
    return (
      <div className={`home is-wide${detail ? ' has-detail' : ''}`}>
        <aside className="home-side" aria-label="찜질방 목록">
          {headEl}
          {listEl}
        </aside>
        {detail && <aside className="home-detail" aria-label="찜질방 상세">{detail}</aside>}
        {mapEl}
        {sheetEl}
        {pickerEl}
      </div>
    );
  }

  return (
    <div className={`home is-mobile sheet-${dragH != null ? 'drag' : sheet}`} style={{ ['--m-top' as string]: `${topH}px`, ['--m-sheet' as string]: `${sheetH}px` }}>
      {mapEl}
      <div className="m-top" ref={topRef}>
        <SearchField
          placeholder="찜질방, 동네, 역 이름으로 찾기"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onDeleteClick={() => setQ('')}
          onFocus={() => setSheet((s) => (s === 'peek' ? 'half' : s))}
          aria-label="찜질방 검색"
        />
        {chipRow}
      </div>
      <div
        className="m-sheet"
        style={{ height: sheetH }}
        onPointerDown={onSheetDown}
        onPointerMove={onSheetMove}
        onPointerUp={onSheetUp}
        onPointerCancel={onSheetUp}
      >
        <div className="m-grab" role="button" tabIndex={0} aria-label={sheet === 'full' ? '목록 줄이기' : '목록 크게 보기'}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSheet((s) => (s === 'full' ? 'half' : s === 'half' ? 'full' : 'half')); } }}>
          <span className="m-grab-bar" aria-hidden="true" />
        </div>
        <div className="m-sheet-body" ref={listRef}>
          {listEl}
        </div>
      </div>
      {sheetEl}
      {pickerEl}
    </div>
  );
}

function Caret() {
  return (
    <svg className="pick-caret" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
  );
}
