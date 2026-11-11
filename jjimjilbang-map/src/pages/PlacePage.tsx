import { useEffect, type ReactNode } from 'react';
import {
  Badge,
  Border,
  Button,
  FixedBottomCTA,
  List,
  ListHeader,
  ListRow,
  Paragraph,
  Spacing,
  TableRow,
  TextButton,
  Top,
} from '@toss/tds-mobile';
import { colors } from '@toss/tds-colors';
import { useApp } from '../AppContext';
import { Icon, type IconName } from '../components/Icon';
import { StatusText } from '../components/PlaceBits';
import {
  FACILITIES,
  category,
  instaTagUrl,
  naverBlogSearchUrl,
  naverInfo,
  naverPlaceUrl,
  photoList,
  signature,
  won,
  type Place,
  type PriceRow,
} from '../lib/data';
import { copyText, openExternal, sharePlace, subscribeBack } from '../lib/toss';

const GROUP_TITLES: Record<string, string> = { 찜질: '찜질 이용 (찜질+목욕)', 목욕: '목욕·사우나만', 기타: '기타 요금' };

export function PlacePage({ place: p, onBack }: { place: Place; onBack: () => void }) {
  const { favs, toggleFav, toast } = useApp();
  const fav = favs.has(p.id);

  // 토스 내비게이션 바의 뒤로 가기를 누르면 미니앱을 닫지 않고 홈으로 돌아가요.
  useEffect(() => subscribeBack(onBack), [onBack]);

  const open = (url: string) => { openExternal(url).catch(() => toast('링크를 열지 못했어요')); };
  const copy = (text: string, what: string) => {
    copyText(text).then(() => toast(`${what}를 복사했어요`)).catch(() => toast(text));
  };
  const share = () => {
    sharePlace(p.id, p.name).then((r) => { if (r === 'copied') toast('링크를 복사했어요'); }).catch(() => {});
  };

  const groups = (['찜질', '목욕', '기타'] as const)
    .map((t) => ({ t, rows: p.prices.filter((r) => (r.type || '찜질') === t) }))
    .filter((g) => g.rows.length);
  const nv = naverInfo(p);
  const blog = nv?.blog?.length
    ? nv.blog.slice(0, 5).map((b) => ({ title: b.title, url: b.link, meta: [b.bloggername, b.postdate].filter(Boolean).join(' · ') }))
    : p.reviewLinks.map((r) => ({ title: r.title, url: r.url, meta: [r.source, r.date].filter(Boolean).join(' · ') }));

  return (
    <article className="place">
      <Top
        upper={<div className="badges pad">{badges(p)}</div>}
        subtitleTop={<Top.SubtitleParagraph size={15}>{`${category(p)} · ${p.gu}`}</Top.SubtitleParagraph>}
        title={<Top.TitleParagraph size={22}>{p.name}</Top.TitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph size={15}><StatusText place={p} withDistance /></Top.SubtitleParagraph>}
      />
      {p.alert && <p className="callout pad">{p.alert}</p>}

      <div className="pad actions">
        <Button size="medium" variant={fav ? 'fill' : 'weak'} color={fav ? 'primary' : 'dark'} onClick={() => toggleFav(p.id)} aria-pressed={fav}>
          {fav ? '찜했어요' : '찜하기'}
        </Button>
        <Button size="medium" variant="weak" color="dark" onClick={() => open(naverPlaceUrl(p, 'photo'))}>사진</Button>
        {p.phone && <Button size="medium" variant="weak" color="dark" onClick={() => open(`tel:${p.phone!.replace(/[^0-9+]/g, '')}`)}>전화</Button>}
        <Button size="medium" variant="weak" color="dark" onClick={share}>공유</Button>
      </div>
      <Cover place={p} />

      <Border variant="height16" />
      <ListHeader
        title={<ListHeader.TitleParagraph fontWeight="bold">요금</ListHeader.TitleParagraph>}
        description={p.priceSource?.date ? <ListHeader.DescriptionParagraph>{`${p.priceSource.date} 자료 기준이에요`}</ListHeader.DescriptionParagraph> : undefined}
        descriptionPosition="bottom"
      />
      {groups.length ? (
        groups.map((g) => (
          <section key={g.t} className="price-group">
            <p className="group-title pad">{GROUP_TITLES[g.t]}</p>
            <List>
              {g.rows.map((r, i) => (
                <TableRow key={i} align="space-between" left={<PriceLeft row={r} />} right={won(r.price)} rightFontWeight="bold" />
              ))}
            </List>
          </section>
        ))
      ) : (
        <p className="muted pad">아직 확인된 요금이 없어요. 방문 전에 전화로 확인해 주세요.</p>
      )}
      {(p.includes?.length || p.extraFees?.length) ? (
        <List className="extra-list">
          {p.includes?.length ? <TableRow align="left" leftRatio={30} left="요금에 포함" right={p.includes.join(', ')} /> : null}
          {p.extraFees?.map((x, i) => (
            <TableRow key={i} align="left" leftRatio={30} left={i === 0 ? '추가 요금' : ''} right={`${x.label} ${typeof x.price === 'number' ? won(x.price) : x.price}`} />
          ))}
        </List>
      ) : null}
      <div className="pad notes">
        {p.priceNote && <Paragraph.Text typography="t7" color={colors.grey600}>{p.priceNote}</Paragraph.Text>}
        {p.priceSource?.url && (
          <TextButton size="small" variant="underline" color={colors.grey600} onClick={() => open(p.priceSource!.url)}>
            {`출처: ${p.priceSource.label || '원문 보기'}`}
          </TextButton>
        )}
      </div>

      <Border variant="height16" />
      <ListHeader title={<ListHeader.TitleParagraph fontWeight="bold">기본 정보</ListHeader.TitleParagraph>} />
      <List>
        {p.address && (
          <InfoRow icon="pin" label="주소" value={p.address} sub={p.station ?? undefined}
            action={<Button size="small" variant="weak" color="dark" onClick={() => copy(p.address!, '주소')}>복사</Button>} />
        )}
        <InfoRow icon="clock" label="영업" value={<StatusText place={p} withReview={false} />} sub={p.hours ?? undefined} />
        {p.phone && (
          <InfoRow icon="phone" label="전화" value={p.phone}
            action={<Button size="small" variant="weak" color="dark" onClick={() => copy(p.phone!, '전화번호')}>복사</Button>} />
        )}
        <InfoRow icon="users" label="이용" value={p.gender === 'female' ? '여성 전용' : p.gender === 'male' ? '남성 전용' : '남녀 모두 (탕은 따로)'} />
      </List>

      <Border variant="height16" />
      <ListHeader title={<ListHeader.TitleParagraph fontWeight="bold">시설</ListHeader.TitleParagraph>} />
      {FACILITIES.groups.map((g) => {
        const items = p.facilities.filter((k) => FACILITIES.items[k]?.group === g.id);
        if (!items.length) return null;
        return (
          <div key={g.id} className="fac-group pad">
            <p className="group-title">{g.label}</p>
            <ul className="fac-grid">
              {items.map((k) => (
                <li key={k} className="fac"><span className="fac-ico" aria-hidden="true">{FACILITIES.items[k].icon}</span>{FACILITIES.items[k].label}</li>
              ))}
            </ul>
          </div>
        );
      })}
      {p.facilityNotes && <p className="notes-text pad">{p.facilityNotes}</p>}

      {(p.highlights.length > 0 || p.cons.length > 0) && (
        <>
          <Border variant="height16" />
          {p.highlights.length > 0 && (
            <>
              <ListHeader title={<ListHeader.TitleParagraph fontWeight="bold">이런 점이 좋았어요</ListHeader.TitleParagraph>} />
              <List>
                {p.highlights.map((t, i) => (
                  <ListRow key={i} verticalPadding="small" left={<span className="kw-ico good"><Icon name="check" size={16} /></span>}
                    contents={<ListRow.Texts type="1RowTypeA" top={t} />} border="none" />
                ))}
              </List>
            </>
          )}
          {p.cons.length > 0 && (
            <>
              <ListHeader title={<ListHeader.TitleParagraph fontWeight="bold">이런 점은 아쉬워요</ListHeader.TitleParagraph>} />
              <List>
                {p.cons.map((t, i) => (
                  <ListRow key={i} verticalPadding="small" left={<span className="kw-ico"><Icon name="minusCircle" size={16} /></span>}
                    contents={<ListRow.Texts type="1RowTypeA" top={t} />} border="none" />
                ))}
              </List>
            </>
          )}
          <p className="fineprint pad">블로그·기사 후기를 읽고 직접 요약했어요.</p>
        </>
      )}

      <Border variant="height16" />
      <ListHeader title={<ListHeader.TitleParagraph fontWeight="bold">후기 모아보기</ListHeader.TitleParagraph>} />
      <List>
        {blog.map((b, i) => (
          <ListRow key={i} onClick={() => open(b.url)} withTouchEffect arrowType="right"
            contents={<ListRow.Texts type="2RowTypeA" top={b.title} bottom={b.meta || '원문 보기'} />} />
        ))}
        <ListRow onClick={() => open(naverBlogSearchUrl(p))} withTouchEffect arrowType="right"
          contents={<ListRow.Texts type="1RowTypeA" top="네이버 블로그 후기 더 보기" />} />
        <ListRow onClick={() => open(naverPlaceUrl(p, 'review/visitor'))} withTouchEffect arrowType="right"
          contents={<ListRow.Texts type="1RowTypeA" top="네이버 방문자 리뷰 보기" />} />
        {p.hashtags.slice(0, 2).map((t) => (
          <ListRow key={t} onClick={() => open(instaTagUrl(t))} withTouchEffect arrowType="right"
            contents={<ListRow.Texts type="1RowTypeA" top={`인스타그램 #${t}`} />} />
        ))}
      </List>

      <div className="pad sources">
        {p.operatingEvidence && <p>{`영업 확인: ${p.operatingEvidence}`}</p>}
        {p.coordsApprox && <p>지도 위치는 주소로 추정한 값이에요.</p>}
        <p>요금과 운영 시간은 자주 바뀌어요. 방문 전에 한 번 더 확인해 주세요.</p>
      </div>
      <Spacing size={120} />

      <FixedBottomCTA onClick={() => open(naverPlaceUrl(p))}>네이버 지도에서 보기</FixedBottomCTA>
    </article>
  );
}

function badges(p: Place) {
  const list: ReactNode[] = [];
  if (p.open24h) list.push(<Badge key="24" size="small" variant="weak" color="blue">24시간</Badge>);
  if (p.gender === 'female') list.push(<Badge key="f" size="small" variant="weak" color="teal">여성전용</Badge>);
  if (p.confidence === 'low') list.push(<Badge key="c" size="small" variant="weak" color="yellow">정보 확인 필요</Badge>);
  if (p.minPrice) list.push(<Badge key="p" size="small" variant="weak" color="elephant">{`어른 ${won(p.minPrice)}부터`}</Badge>);
  return list;
}

function PriceLeft({ row }: { row: PriceRow }) {
  const sub = [row.days && row.days !== '전체' ? row.days : '', row.time || '', row.note || ''].filter(Boolean).join(' · ');
  return (
    <span className="price-left">
      <span>{row.label}{row.who && row.who !== '공통' && <span className="who">{row.who}</span>}</span>
      {sub && <span className="price-sub">{sub}</span>}
    </span>
  );
}

function InfoRow({ icon, label, value, sub, action }: { icon: IconName; label: string; value: ReactNode; sub?: string; action?: ReactNode }) {
  return (
    <ListRow
      left={<span className="info-ico" aria-label={label}><Icon name={icon} size={18} /></span>}
      contents={
        <span className="info-val">
          <span>{value}</span>
          {sub && <span className="info-sub">{sub}</span>}
        </span>
      }
      right={action}
      verticalPadding="medium"
    />
  );
}

function Cover({ place: p }: { place: Place }) {
  const photos = photoList(p);
  if (photos.length) {
    return (
      <div className="cover-strip pad">
        {photos.slice(0, 6).map((ph, i) => (
          <img key={i} src={ph.src} alt={ph.alt} loading="lazy" referrerPolicy="no-referrer" />
        ))}
      </div>
    );
  }
  const sig = signature(p, 3);
  return (
    <div className="cover-strip pad" aria-hidden="true">
      {sig.map((k) => (
        <span key={k} className={`cover-tile tone-${FACILITIES.items[k].group}`}>
          <span className="cover-ico">{FACILITIES.items[k].icon}</span>
          <span className="cover-lbl">{FACILITIES.items[k].short}</span>
        </span>
      ))}
    </div>
  );
}
