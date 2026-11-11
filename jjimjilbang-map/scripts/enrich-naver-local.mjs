#!/usr/bin/env node
// 네이버 지역 검색 API로 좌표·주소·전화번호를 확인합니다.
//
//   NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... node scripts/enrich-naver-local.mjs          # 비교표만 출력
//   NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... node scripts/enrich-naver-local.mjs --write  # places.json에 반영
//
// 지역 검색은 한 번에 최대 5개 결과만 주고, mapx/mapy 는 WGS84 경위도에 10^7을 곱한 정수입니다.
import { file, readJson, writeJson, stripTags, norm } from './lib/datafile.mjs';
import { credentials, search } from './lib/naver-search.mjs';

const write = process.argv.includes('--write');
const cred = credentials();
const placesFile = file('data', 'places.json');
const data = readJson(placesFile);

function toDeg(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n > 1000 ? n / 1e7 : n; // 정수형(×10^7)과 소수형 모두 처리
}

function distM(a, b) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

let changed = 0;
for (const place of data.places) {
  const res = await search('local.json', { query: place.naverQuery || place.name, display: 5 }, cred);
  const items = (res.items || []).map((it) => ({ ...it, title: stripTags(it.title) }));
  const want = norm(place.name);
  const best = items.find((it) => (norm(it.title).includes(want) || want.includes(norm(it.title))) && (it.roadAddress || it.address || '').includes(place.gu))
    || items.find((it) => (it.roadAddress || it.address || '').includes(place.gu));
  if (!best) {
    console.log(`? ${place.name}: 지역 검색 결과에서 같은 구의 장소를 찾지 못했어요`);
    continue;
  }
  const lat = toDeg(best.mapy), lng = toDeg(best.mapx);
  if (!lat || !lng || lat < 37 || lat > 38 || lng < 126 || lng > 128) {
    console.log(`? ${place.name}: 좌표 형식이 예상과 달라요 (mapx=${best.mapx}, mapy=${best.mapy})`);
    continue;
  }
  const moved = distM(place, { lat, lng });
  console.log(`${moved > 150 ? '!' : '✓'} ${place.name} → ${best.title} | ${best.roadAddress} | ${best.telephone || '-'} | 좌표 차이 ${moved}m`);
  if (write) {
    place.lat = Number(lat.toFixed(6));
    place.lng = Number(lng.toFixed(6));
    place.coordsApprox = false;
    if (!place.address && best.roadAddress) place.address = best.roadAddress;
    if (!place.phone && best.telephone) place.phone = best.telephone;
    changed++;
  }
}

if (write) {
  writeJson(placesFile, data);
  console.log(`${changed}곳을 고쳤어요. git diff 로 확인한 뒤 커밋하세요.`);
}
