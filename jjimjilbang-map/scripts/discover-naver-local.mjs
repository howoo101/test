#!/usr/bin/env node
// 네이버 지역 검색(네이버 지도에 등록된 장소)으로 한 동네의 찜질방·사우나를 빠짐없이 찾아요.
//
//   NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... node scripts/discover-naver-local.mjs 진접,오남,별내
//
// - 지역 검색은 한 번에 5곳까지만 줘요. 그래서 "동네 × 검색어 × 정렬" 조합을 여러 번 불러 모아요 (동네 1곳에 약 40회).
// - 주소에 그 동네(읍·면·동) 이름이 들어간 곳만 남기고, 업종이 찜질방·사우나·목욕·스파·한증막인 곳만 골라요.
// - 결과는 표로 보여주고, 한 줄씩 "FOUND\t{json}" 으로도 찍어요 (data/places.json 에 옮기기 쉽게).
// - 이미 places.json 에 있는 곳은 "있음" 으로 표시해요.
import { file, readJson, stripTags, norm } from './lib/datafile.mjs';
import { credentials, search } from './lib/naver-search.mjs';

const cred = credentials();
const areas = (process.argv[2] || process.env.DISCOVER || '').split(/[,\s]+/).filter(Boolean);
if (!areas.length) {
  console.error('찾을 동네를 적어 주세요. 예: node scripts/discover-naver-local.mjs 진접,오남,별내');
  process.exit(2);
}

// 동네 이름 → 검색에 덧붙일 말, 주소에서 확인할 말
const AREA = {
  진접: { q: ['진접', '진접역', '남양주 진접'], addr: ['진접읍', '진접'] },
  오남: { q: ['오남', '오남역', '남양주 오남'], addr: ['오남읍', '오남'] },
  별내: { q: ['별내', '별내별가람역', '별내역', '남양주 별내'], addr: ['별내동', '별내면', '별내'] },
};
const KEYWORDS = ['찜질방', '사우나', '불가마', '한증막', '목욕탕', '스파', '24시 사우나'];
const CATEGORY = /찜질|사우나|목욕|스파|한증|불가마|온천|대중탕/;

const toDeg = (v) => { const n = Number(v); return Number.isFinite(n) ? (n > 1000 ? n / 1e7 : n) : null; };
const { places } = readJson(file('data', 'places.json'));
const known = places.map((p) => ({ name: norm(p.name), aliases: (p.aliases || []).map(norm), addr: norm(p.address || '') }));

const found = new Map();
let calls = 0;
for (const area of areas) {
  const a = AREA[area] || { q: [area], addr: [area] };
  for (const pre of a.q) {
    for (const kw of KEYWORDS) {
      for (const sort of ['random', 'comment']) {
        let res;
        try {
          res = await search('local.json', { query: `${pre} ${kw}`, display: 5, start: 1, sort }, cred);
          calls++;
        } catch (e) {
          console.error(`✗ ${pre} ${kw}: ${e.message}`);
          if (/\(429\)/.test(e.message)) process.exit(1);
          continue;
        }
        for (const it of res.items || []) {
          const title = stripTags(it.title);
          const address = it.roadAddress || it.address || '';
          const jibun = it.address || '';
          if (!/남양주/.test(address + jibun)) continue;
          if (!a.addr.some((w) => (address + ' ' + jibun).includes(w))) continue;
          if (!CATEGORY.test(it.category || '') && !CATEGORY.test(title)) continue;
          const key = norm(title) + '|' + norm(address);
          if (found.has(key)) { found.get(key).hits++; continue; }
          found.set(key, {
            area, title, category: it.category || '', roadAddress: it.roadAddress || '', address: jibun,
            phone: it.telephone || '', link: it.link || '', lat: toDeg(it.mapy), lng: toDeg(it.mapx), hits: 1,
          });
        }
      }
    }
  }
}

const list = [...found.values()].sort((x, y) => x.area.localeCompare(y.area) || y.hits - x.hits);
console.log(`\n지역 검색 ${calls}회, 찾은 곳 ${list.length}곳\n`);
for (const r of list) {
  const n = norm(r.title);
  const have = known.some((k) => k.name === n || k.aliases.includes(n) || n.includes(k.name) || k.name.includes(n) || (r.roadAddress && k.addr.includes(norm(r.roadAddress).slice(0, 14))));
  r.known = have;
  console.log(`${have ? '있음' : '새로'} | ${r.area} | ${r.title} | ${r.category} | ${r.roadAddress || r.address} | ${r.phone || '-'} | ${r.lat?.toFixed(5)},${r.lng?.toFixed(5)} | 검색 ${r.hits}회`);
}
console.log('');
for (const r of list) console.log('FOUND\t' + JSON.stringify(r));
