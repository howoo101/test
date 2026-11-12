import { useMemo, useState } from 'react';
import {
  BottomSheet,
  Button,
  Chip,
  ChipItem,
  List,
  ListHeader,
  Paragraph,
  SearchField,
  SegmentedControl,
  Top,
} from '@toss/tds-mobile';
import { colors } from '@toss/tds-colors';
import { useApp } from '../AppContext';
import { MapView } from '../components/MapView';
import { PlaceRow } from '../components/PlaceBits';
import { DATA_UPDATED_AT, FACILITIES, PLACES, SORT_LABELS, filterPlaces, type SortKey } from '../lib/data';

type View = 'map' | 'list';

const CHIPS: { id: string; label: string }[] = [
  { id: 'open', label: '영업 중' },
  { id: 'sns', label: '유튜브·인스타 추천' },
  { id: 'open24h', label: '24시간' },
  { id: 'under15k', label: '1.5만원 이하' },
  { id: 'fav', label: '찜한 곳' },
  { id: 'female', label: '여성전용' },
  ...FACILITIES.quickFilters.map((k) => ({ id: k, label: FACILITIES.items[k].short })),
];

export function HomePage({ onOpen, active }: { onOpen: (id: string) => void; active: boolean }) {
  const { favs, userPos, locate } = useApp();
  const [q, setQ] = useState('');
  const [chips, setChips] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortKey>('rec');
  const [sortOpen, setSortOpen] = useState(false);
  const [view, setView] = useState<View>('map');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const places = useMemo(() => filterPlaces({ q, chips, favs, sort, userPos }), [q, chips, favs, sort, userPos]);
  const fitKey = `${q}|${[...chips].sort().join(',')}`;

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

  const resetFilters = () => { setQ(''); setChips(new Set()); };

  return (
    <div className={`home is-${view}`}>
      <header className="home-head">
        {view === 'list' && (
          <Top
            title={<Top.TitleParagraph size={22}>서울 찜질방, 요금부터 비교해요</Top.TitleParagraph>}
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
        <div className="chip-row">
          <Chip kind="select" size="medium">
            <ChipItem selected={chips.size === 0} onClick={() => toggleChip('all')}>전체</ChipItem>
            {CHIPS.map((c) => (
              <ChipItem key={c.id} selected={chips.has(c.id)} onClick={() => toggleChip(c.id)}>{c.label}</ChipItem>
            ))}
          </Chip>
        </div>
        <div className="pad seg">
          <SegmentedControl name="view" value={view} onChange={(v) => setView(v as View)} size="large">
            <SegmentedControl.Item value="map">지도</SegmentedControl.Item>
            <SegmentedControl.Item value="list">목록</SegmentedControl.Item>
          </SegmentedControl>
        </div>
      </header>

      <div className="home-map" hidden={view !== 'map'}>
        <MapView
          places={places}
          selectedId={selectedId && places.some((p) => p.id === selectedId) ? selectedId : null}
          onSelect={setSelectedId}
          onOpen={onOpen}
          active={active && view === 'map'}
          fitKey={fitKey}
        />
      </div>

      <section className="home-list" hidden={view !== 'list'}>
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
            {places.map((p) => <PlaceRow key={p.id} place={p} onClick={() => onOpen(p.id)} />)}
          </List>
        ) : (
          <div className="empty pad">
            <Paragraph.Text typography="t5" fontWeight="bold" color={colors.grey800}>조건에 맞는 찜질방이 없어요</Paragraph.Text>
            <Paragraph.Text typography="t6" color={colors.grey600}>필터를 줄여서 다시 찾아보세요.</Paragraph.Text>
            <Button size="medium" variant="weak" onClick={resetFilters}>필터 초기화</Button>
          </div>
        )}
        <p className="fineprint pad">
          {`요금은 ${DATA_UPDATED_AT.slice(0, 7).replace('-', '년 ')}월까지 모은 공개 자료 기준이에요. 방문 전에 한 번 더 확인해 주세요.`}
        </p>
      </section>

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
    </div>
  );
}
