#!/usr/bin/env node
// 장소마다 유튜브 영상 검색 결과를 모아 data/youtube-content.json 을 만듭니다.
//
//   YOUTUBE_API_KEY=... node scripts/fetch-youtube.mjs [--only 장소id]
//
// - YouTube Data API v3 를 써요 (Google Cloud 콘솔에서 API 키 발급, 하루 무료 10,000 단위).
//   검색 1번에 100단위라 17곳이면 하루 1,700단위 정도예요.
// - 화면에는 제목·채널·날짜·조회수와 링크만 보여주고 영상은 유튜브에서 열어요.
// - 자동 수집 결과에는 평가(추천·아쉬움)가 없어요. 추천 영상으로 보여주려면
//   data/places.json 의 reviewLinks 에 verdict·note 와 함께 직접 옮겨 주세요.
// - reviewLinks 에 있는 추천 영상은 채널·날짜·조회수를 채워 두고(videos),
//   지워졌거나 비공개가 된 영상은 unavailable 에 적어 화면과 추천순에서 빼요.
// - YouTube API 정책상 저장한 데이터는 주기적으로 새로 받아야 해요. GitHub Actions 가 매일 다시 받아요.
import { file, readJson, writeJson, norm, sleep } from './lib/datafile.mjs';

const KEY = process.env.YOUTUBE_API_KEY;
if (!KEY) {
  console.error('YOUTUBE_API_KEY 가 없어요. Google Cloud 콘솔에서 YouTube Data API v3 키를 만들어 넣어 주세요.');
  process.exit(1);
}
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

const API = 'https://www.googleapis.com/youtube/v3';
const outFile = file('data', 'youtube-content.json');
const { places } = readJson(file('data', 'places.json'));
const prev = readJson(outFile, { byPlace: {} });

async function get(path, params) {
  const url = `${API}/${path}?${new URLSearchParams({ ...params, key: KEY })}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${body?.error?.message || ''}`.trim());
  return body;
}

const decode = (s) => String(s || '')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// 제목·설명에 장소 이름(또는 별칭)이 실제로 들어간 영상만 남겨요. 같은 이름의 다른 지점은 사람이 걸러 주세요.
function mentions(place, text) {
  const t = norm(text);
  return [place.name, ...(place.aliases || [])].some((n) => n && t.includes(norm(n)));
}

const byPlace = { ...(prev.byPlace || {}) };
for (const place of places) {
  if (only && place.id !== only) continue;
  const q = `${place.naverQuery || place.name} 찜질방`;
  try {
    const search = await get('search', {
      part: 'snippet', type: 'video', q, maxResults: '15', regionCode: 'KR', relevanceLanguage: 'ko', safeSearch: 'moderate',
    });
    const hits = (search.items || [])
      .filter((it) => it.id?.videoId && mentions(place, `${it.snippet?.title} ${it.snippet?.description}`))
      .slice(0, 8);
    let stats = {};
    if (hits.length) {
      const v = await get('videos', { part: 'statistics', id: hits.map((h) => h.id.videoId).join(',') });
      stats = Object.fromEntries((v.items || []).map((it) => [it.id, Number(it.statistics?.viewCount || 0)]));
    }
    byPlace[place.id] = hits.map((h) => ({
      url: `https://www.youtube.com/watch?v=${h.id.videoId}`,
      title: decode(h.snippet.title),
      channel: decode(h.snippet.channelTitle) || null,
      publishedAt: h.snippet.publishedAt ? h.snippet.publishedAt.slice(0, 10) : null,
      views: stats[h.id.videoId] ?? null,
    }));
    console.log(`✓ ${place.name}: 영상 ${hits.length}개`);
    await sleep(200);
  } catch (e) {
    console.error(`✗ ${place.name}: ${e.message}`);
    process.exitCode = 1;
  }
}

const ids = new Set(places.map((p) => p.id));
Object.keys(byPlace).forEach((id) => { if (!ids.has(id)) delete byPlace[id]; });

// 사람이 고른 추천 영상(reviewLinks)도 확인해요: 채널·날짜·조회수를 채우고, 지워졌거나 비공개로 바뀐 영상을 찾아요.
const ytId = (u) => /(?:youtu\.be\/|[?&]v=|\/shorts\/)([\w-]{11})/.exec(u)?.[1] ?? null;
const curated = [...new Set(places.flatMap((p) => (p.reviewLinks || []).map((r) => (/youtu/.test(r.url) ? ytId(r.url) : null)).filter(Boolean)))];
const videos = {};
const unavailable = [];
for (let i = 0; i < curated.length; i += 50) {
  const batch = curated.slice(i, i + 50);
  try {
    const v = await get('videos', { part: 'snippet,statistics,status', id: batch.join(',') });
    const found = new Map((v.items || []).map((it) => [it.id, it]));
    for (const id of batch) {
      const it = found.get(id);
      if (!it || it.status?.privacyStatus === 'private') { unavailable.push(id); continue; }
      videos[id] = {
        channel: decode(it.snippet?.channelTitle) || null,
        publishedAt: it.snippet?.publishedAt ? it.snippet.publishedAt.slice(0, 10) : null,
        views: Number(it.statistics?.viewCount || 0),
      };
    }
  } catch (e) {
    console.error(`✗ 추천 영상 확인: ${e.message}`);
    process.exitCode = 1;
  }
}
if (unavailable.length) console.warn(`볼 수 없는 추천 영상 ${unavailable.length}개 (화면에서 빼요): ${unavailable.join(', ')}`);

writeJson(outFile, { updatedAt: new Date().toISOString().slice(0, 10), byPlace, videos, unavailable });
console.log(`저장: ${outFile} (추천 영상 ${Object.keys(videos).length}개 확인)`);
