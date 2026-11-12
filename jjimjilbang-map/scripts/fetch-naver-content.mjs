#!/usr/bin/env node
// 장소마다 네이버 블로그 후기와 이미지 검색 결과를 모아 data/naver-content.json 을 만듭니다.
//
//   NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... node scripts/fetch-naver-content.mjs [--only 장소id | --all | --days 7 --max 80]
//
// 한도를 아끼려고 받은 지 7일이 안 된 곳은 건너뛰고, 한 번에 최대 80곳(장소당 2회 호출)만 받아요.
//
// 화면에는 제목·요약·링크만 보여주고 원문으로 연결합니다(본문 복사 금지).
import { file, readJson, writeJson, stripTags, norm, pickStale } from './lib/datafile.mjs';
import { credentials, search } from './lib/naver-search.mjs';

const cred = credentials();

const outFile = file('data', 'naver-content.json');
const { places } = readJson(file('data', 'places.json'));
const prev = readJson(outFile, { byPlace: {} });

// 제목·요약에 장소 이름(또는 별칭)이 들어 있고, 같은 이름의 다른 지점을 가리키는 말(naverExclude)이 없어야 해요.
function mentions(place, text) {
  const t = norm(text);
  if ((place.naverExclude || []).some((w) => w && t.includes(norm(w)))) return false;
  return [place.name, ...(place.aliases || [])].some((n) => n && t.includes(norm(n)));
}

const byPlace = { ...(prev.byPlace || {}) };
const targets = pickStale(places, (id) => prev.byPlace?.[id]?.fetchedAt, { days: 7, max: 80 });
for (const place of targets) {
  const q = place.naverQuery || place.name;
  try {
    const blog = await search('blog.json', { query: `${q} 후기`, display: 30, sort: 'sim' }, cred);
    const posts = (blog.items || [])
      .map((it) => ({
        title: stripTags(it.title),
        link: it.link,
        description: stripTags(it.description).slice(0, 140),
        bloggername: stripTags(it.bloggername),
        postdate: it.postdate ? `${it.postdate.slice(0, 4)}-${it.postdate.slice(4, 6)}-${it.postdate.slice(6, 8)}` : null
      }))
      .filter((it) => mentions(place, it.title + ' ' + it.description))
      .slice(0, 8);

    const img = await search('image', { query: q, display: 60, sort: 'sim', filter: 'large' }, cred);
    const images = (img.items || [])
      // 이미지 검색은 비슷한 이름의 다른 찜질방 사진도 섞여 나와요. 제목에 이 장소 이름이 있는 사진만 써요.
      .filter((it) => Number(it.sizewidth) >= 400 && mentions(place, it.title))
      .map((it) => ({ title: stripTags(it.title), link: it.link, thumbnail: it.thumbnail }))
      .slice(0, 8);

    byPlace[place.id] = { blogTotal: blog.total || 0, blog: posts, images, fetchedAt: new Date().toISOString().slice(0, 10) };
    console.log(`✓ ${place.name}: 블로그 ${posts.length}/${blog.total}건, 이미지 ${images.length}장`);
  } catch (e) {
    console.error(`✗ ${place.name}: ${e.message}`);
    process.exitCode = 1;
    // 한도 초과(429)면 더 부르지 않고 지금까지 받은 것만 저장해요.
    if (/\(429\)/.test(e.message)) { console.error('네이버 호출 한도에 걸려 멈춰요. 나머지는 다음 실행에 받아요.'); break; }
  }
}

// 데이터에서 빠진 장소는 정리합니다.
const ids = new Set(places.map((p) => p.id));
Object.keys(byPlace).forEach((id) => { if (!ids.has(id)) delete byPlace[id]; });

writeJson(outFile, { updatedAt: new Date().toISOString().slice(0, 10), byPlace });
console.log(`저장: ${outFile}`);
