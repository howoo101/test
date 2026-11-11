import { useEffect, useState, type ReactNode } from 'react';
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
  PLATFORM_LABEL,
  VERDICT_LABEL,
  category,
  instaTagUrl,
  naverBlogSearchUrl,
  naverInfo,
  naverPlaceUrl,
  naverRouteScheme,
  photoList,
  platformOf,
  reviewHeadline,
  signature,
  snsBadge,
  won,
  youtubeId,
  youtubeSearchUrl,
  youtubeVideos,
  type Place,
  type PriceRow,
  type ReviewLink,
  type ReviewPlatform,
  type Verdict,
} from '../lib/data';
import { copyText, openAppWithFallback, openExternal, sharePlace, subscribeBack } from '../lib/toss';

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
  // 네이버 지도 앱의 대중교통 길찾기를 현재 위치 출발로 바로 열어요. 앱이 없으면 네이버 지도 웹의 장소 화면으로.
  const route = () => {
    openAppWithFallback(naverRouteScheme(p), naverPlaceUrl(p)).catch(() => toast('네이버 지도를 열지 못했어요'));
  };

  const groups = (['찜질', '목욕', '기타'] as const)
    .map((t) => ({ t, rows: p.prices.filter((r) => (r.type || '찜질') === t) }))
    .filter((g) => g.rows.length);
  return (
    <article className="place">
      <Top
        upper={<div className="badges pad">{badges(p)}</div>}
        subtitleTop={<Top.SubtitleParagraph size={15}>{`${category(p)} · ${p.gu}`}</Top.SubtitleParagraph>}
        title={<Top.TitleParagraph size={22}>{p.name}</Top.TitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph size={15}><StatusText place={p} withReview={false} withDistance /></Top.SubtitleParagraph>}
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

      <ReviewSection place={p} open={open} />

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

      <div className="pad sources">
        {p.operatingEvidence && <p>{`영업 확인: ${p.operatingEvidence}`}</p>}
        {p.coordsApprox && (
          <p>
            지도 위치와 길찾기 도착 지점은 주소로 추정한 값이에요.{' '}
            <TextButton size="xsmall" variant="underline" color={colors.grey600} onClick={() => open(naverPlaceUrl(p))}>네이버 지도에서 장소 확인</TextButton>
          </p>
        )}
        <p>요금과 운영 시간은 자주 바뀌어요. 방문 전에 한 번 더 확인해 주세요.</p>
      </div>
      <Spacing size={140} />

      <FixedBottomCTA
        topAccessory={p.coordsApprox ? <p className="cta-note">도착 지점은 주소로 추정한 위치예요</p> : undefined}
        onClick={route}
      >
        네이버 지도로 길찾기
      </FixedBottomCTA>
    </article>
  );
}

// ---------------------------------------------------------------- 후기 평가
type ReviewItem = ReviewLink & { auto?: boolean };

const PLATFORMS: ReviewPlatform[] = ['youtube', 'instagram', 'web'];
const PLATFORM_ICON: Record<ReviewPlatform, IconName> = { youtube: 'play', instagram: 'photo', web: 'doc' };
const VERDICT_ORDER: Record<Verdict | 'none', number> = { recommend: 0, mixed: 1, none: 2, negative: 3 };
const SHOW = 3;

// 같은 글·영상인지 비교할 때 쓰는 열쇠 (유튜브는 영상 id로)
function urlKey(u: string) {
  const yt = youtubeId(u);
  if (yt) return 'yt:' + yt;
  return u.replace(/^https?:\/\/(www\.|m\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '');
}
const fmtDate = (d?: string | null) => (d ? d.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3').replace(/-/g, '.') : '');

// 추천 → 장단점 → 평가 없음 → 아쉬움 순서로, 같은 평가면 그곳만 다룬 후기를 묶음 글보다 먼저, 그다음 최신순
function sortReviews(list: ReviewLink[]) {
  const kindOrder = (r: ReviewLink) => (r.kind === 'list' ? 1 : 0);
  return [...list].sort((a, b) =>
    VERDICT_ORDER[a.verdict ?? 'none'] - VERDICT_ORDER[b.verdict ?? 'none']
    || kindOrder(a) - kindOrder(b)
    || (b.date || '').localeCompare(a.date || ''));
}

function ReviewSection({ place: p, open }: { place: Place; open: (url: string) => void }) {
  const [expanded, setExpanded] = useState<Set<ReviewPlatform>>(new Set());
  const s = p.reviews;
  const nv = naverInfo(p);
  // 직접 고른 글·영상(평가 있음)을 먼저, 자동으로 모은 최신 글·영상은 뒤에 붙여요.
  const auto: Record<ReviewPlatform, ReviewItem[]> = {
    youtube: youtubeVideos(p).map((v) => ({ title: v.title, url: v.url, author: v.channel ?? null, date: v.publishedAt?.slice(0, 10) ?? null, auto: true })),
    instagram: [],
    web: (nv?.blog ?? []).slice(0, 5).map((b) => ({ title: b.title, url: b.link, author: b.bloggername ?? null, source: '네이버 블로그', date: b.postdate ?? null, auto: true })),
  };
  const groups = PLATFORMS.map((pf) => {
    const items: ReviewItem[] = sortReviews(p.reviewLinks.filter((r) => platformOf(r) === pf));
    const seen = new Set(items.map((r) => urlKey(r.url)));
    for (const a of auto[pf]) if (!seen.has(urlKey(a.url))) { seen.add(urlKey(a.url)); items.push(a); }
    return { pf, items };
  }).filter((g) => g.items.length);
  return (
    <>
      <Border variant="height16" />
      <ListHeader
        title={<ListHeader.TitleParagraph fontWeight="bold">후기 평가</ListHeader.TitleParagraph>}
        description={<ListHeader.DescriptionParagraph>{reviewHeadline(s)}</ListHeader.DescriptionParagraph>}
        descriptionPosition="bottom"
      />
      {s.total > 0 && (
        <>
          <div className="pad review-stats" role="group" aria-label="후기 평가 요약">
            <Stat n={s.recommend} label="추천" tone="good" />
            <Stat n={s.mixed} label="장단점" />
            <Stat n={s.negative} label="아쉬움" tone="bad" />
          </div>
          <p className="pad review-platforms">
            {PLATFORMS.map((pf) => `${PLATFORM_LABEL[pf]} ${s.byPlatform[pf].total}`).join(' · ')}
          </p>
        </>
      )}

      {p.highlights.length > 0 && (
        <>
          <p className="group-title pad">이런 점이 좋았어요</p>
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
          <p className="group-title pad">이런 점은 아쉬워요</p>
          <List>
            {p.cons.map((t, i) => (
              <ListRow key={i} verticalPadding="small" left={<span className="kw-ico"><Icon name="minusCircle" size={16} /></span>}
                contents={<ListRow.Texts type="1RowTypeA" top={t} />} border="none" />
            ))}
          </List>
        </>
      )}

      {groups.map((g) => {
        const all = expanded.has(g.pf);
        const items = all ? g.items : g.items.slice(0, SHOW);
        return (
          <section key={g.pf} className="review-group" aria-label={`${PLATFORM_LABEL[g.pf]} 후기`}>
            <p className="group-title pad">{`${PLATFORM_LABEL[g.pf]} ${g.items.length}`}</p>
            <List>
              {items.map((r) => <ReviewRow key={urlKey(r.url)} item={r} platform={g.pf} onClick={() => open(r.url)} />)}
            </List>
            {!all && g.items.length > SHOW && (
              <div className="pad more">
                <TextButton size="small" variant="arrow" color={colors.grey600} onClick={() => setExpanded(new Set(expanded).add(g.pf))}>
                  {`${g.items.length - SHOW}개 더 보기`}
                </TextButton>
              </div>
            )}
          </section>
        );
      })}

      <p className="group-title pad">더 찾아보기</p>
      <List>
        <LinkRow icon="play" label="유튜브에서 영상 더 찾기" onClick={() => open(youtubeSearchUrl(p))} />
        {p.hashtags.slice(0, 2).map((t) => (
          <LinkRow key={t} icon="photo" label={`인스타그램 #${t}`} onClick={() => open(instaTagUrl(t))} />
        ))}
        <LinkRow icon="doc" label="네이버 블로그 후기 더 보기" onClick={() => open(naverBlogSearchUrl(p))} />
        <LinkRow icon="doc" label="네이버 방문자 리뷰 보기" onClick={() => open(naverPlaceUrl(p, 'review/visitor'))} />
      </List>
      <p className="fineprint pad">
        평가는 글·영상의 제목과 소개에 드러난 내용으로 나눴고, 요약은 직접 썼어요. 누르면 원문으로 이동해요.
      </p>
    </>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`stat${tone ? ' ' + tone : ''}`}>
      <span className="stat-n">{n}</span>
      <span className="stat-l">{label}</span>
    </div>
  );
}

function ReviewRow({ item: r, platform, onClick }: { item: ReviewItem; platform: ReviewPlatform; onClick: () => void }) {
  const who = r.author ? (platform === 'instagram' && !r.author.startsWith('@') ? '@' + r.author : r.author) : r.source;
  const meta = [who, fmtDate(r.date), r.kind === 'list' ? '추천 모음' : '', r.sponsored ? '협찬' : ''].filter(Boolean).join(' · ') || PLATFORM_LABEL[platform];
  const icon = <span className={`rv-ico rv-${platform}`}><Icon name={PLATFORM_ICON[platform]} size={18} /></span>;
  const title = <span className="rv-title">{r.title}</span>;
  if (!r.verdict && !r.note) {
    return (
      <ListRow onClick={onClick} withTouchEffect arrowType="right" left={icon}
        contents={<ListRow.Texts type="2RowTypeA" top={title} bottom={meta} />} />
    );
  }
  return (
    <ListRow onClick={onClick} withTouchEffect arrowType="right" left={icon}
      contents={
        <ListRow.Texts
          type="3RowTypeA"
          top={title}
          middle={
            <span className="rv-note">
              {r.verdict && <b className={`verdict v-${r.verdict}`}>{VERDICT_LABEL[r.verdict]}</b>}
              {r.note}
            </span>
          }
          bottom={meta}
        />
      } />
  );
}

function LinkRow({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <ListRow onClick={onClick} withTouchEffect arrowType="right"
      left={<span className="rv-ico"><Icon name={icon} size={18} /></span>}
      contents={<ListRow.Texts type="1RowTypeA" top={label} />} />
  );
}

function badges(p: Place) {
  const list: ReactNode[] = [];
  const sns = snsBadge(p);
  if (sns) list.push(<Badge key="sns" size="small" variant="weak" color="red">{sns}</Badge>);
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
