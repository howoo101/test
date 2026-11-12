#!/usr/bin/env node
// 장소마다 네이버 블로그 후기와 이미지 검색 결과를 모아 data/naver-content.json 을 만듭니다.
//
//   NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... node scripts/fetch-naver-content.mjs [--only 장소id]
//
// 화면에는 제목·요약·링크만 보여주고 원문으로 연결합니다(본문 복사 금지).
import { file, readJson, writeJson, stripTags, norm } from './lib/datafile.mjs';
import { credentials, search } from './lib/naver-search.mjs';

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const cred = credentials();

const outFile = file('data', 'naver-content.json');
const { places } = readJson(file('data', 'places.json'));
const prev = readJson(outFile, { byPlace: {} });

function mentions(place, text) {
  const t = norm(text);
  return [place.name, ...(place.aliases || [])].some((n) => n && t.includes(norm(n)));
}

const byPlace = { ...(prev.byPlace || {}) };
for (const place of places) {
  if (only && place.id !== only) continue;
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

    const img = await search('image', { query: q, display: 20, sort: 'sim', filter: 'large' }, cred);
    const images = (img.items || [])
      .filter((it) => Number(it.sizewidth) >= 400)
      .map((it) => ({ title: stripTags(it.title), link: it.link, thumbnail: it.thumbnail }))
      .slice(0, 8);

    byPlace[place.id] = { blogTotal: blog.total || 0, blog: posts, images, fetchedAt: new Date().toISOString().slice(0, 10) };
    console.log(`✓ ${place.name}: 블로그 ${posts.length}/${blog.total}건, 이미지 ${images.length}장`);
  } catch (e) {
    console.error(`✗ ${place.name}: ${e.message}`);
    process.exitCode = 1;
  }
}

// 데이터에서 빠진 장소는 정리합니다.
const ids = new Set(places.map((p) => p.id));
Object.keys(byPlace).forEach((id) => { if (!ids.has(id)) delete byPlace[id]; });

writeJson(outFile, { updatedAt: new Date().toISOString().slice(0, 10), byPlace });
console.log(`저장: ${outFile}`);
