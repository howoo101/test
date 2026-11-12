#!/usr/bin/env node
// data/places.json 검사기. 오류가 있으면 종료 코드 1로 끝납니다(GitHub Actions에서도 실행).
//
//   node scripts/validate-data.mjs
import { file, readJson } from './lib/datafile.mjs';

const { places } = readJson(file('data', 'places.json'));
const FAC = readJson(file('data', 'facilities.json'));
const GEO = readJson(file('data', 'seoul-geo.json'));

const errors = [];
const warnings = [];
const err = (p, msg) => errors.push(`${p.name || p.id || '?'}: ${msg}`);
const warn = (p, msg) => warnings.push(`${p.name || p.id || '?'}: ${msg}`);

const GU = new Set(GEO.districts.map((d) => d.name));
const PRICE_TYPES = new Set(['찜질', '목욕', '기타']);
const GENDERS = new Set(['all', 'female', 'male']);
const RESERVED = new Set(['settings', 'sidebar', 'customize', 'upgrade', 'downloads']);

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function guAt(lng, lat) {
  const d = GEO.districts.find((g) => g.rings.some((r) => inRing(lng, lat, r)));
  return d ? d.name : null;
}
function monthsAgo(ym) {
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(ym || '');
  if (!m) return null;
  const now = new Date();
  return (now.getFullYear() - Number(m[1])) * 12 + (now.getMonth() + 1 - Number(m[2] || 6));
}
const isUrl = (u) => /^https?:\/\/[^\s]+$/.test(u || '');

// 후기·추천 링크 (블로그·기사·유튜브·인스타그램)
const PLATFORMS = new Set(['youtube', 'instagram', 'web']);
const KINDS = new Set(['review', 'list']);
const VERDICTS = new Set(['recommend', 'mixed', 'negative']);
const YOUTUBE_URL = /^https:\/\/(www\.youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]{11}/;
const INSTAGRAM_URL = /^https:\/\/www\.instagram\.com\/(p|reel|reels)\/[\w-]+/;
const hostPlatform = (u) => (/^https:\/\/([a-z]+\.)?(youtube\.com|youtu\.be)\//.test(u) ? 'youtube' : /^https:\/\/([a-z]+\.)?instagram\.com\//.test(u) ? 'instagram' : 'web');
let snsLinks = 0;
let snsRecommends = 0;
let igLocations = 0;

// 인스타그램 위치 태그 페이지·공식 계정
function checkInstagram(p) {
  if (!p.instagram) return;
  const { location, account } = p.instagram;
  if (location) {
    if (!/^https:\/\/www\.instagram\.com\/explore\/locations\/\d+\//.test(location.url || '')) err(p, `instagram.location.url 은 instagram.com/explore/locations/숫자/ 주소예요 (${location.url})`);
    if (location.posts != null && !(Number.isInteger(location.posts) && location.posts >= 0)) err(p, 'instagram.location.posts 는 0 이상의 정수예요');
    if (location.checkedAt != null && !/^\d{4}-\d{2}(-\d{2})?$/.test(location.checkedAt)) err(p, 'instagram.location.checkedAt 은 YYYY-MM 또는 YYYY-MM-DD 예요');
    igLocations++;
  }
  if (account) {
    if (!/^https:\/\/www\.instagram\.com\/[A-Za-z0-9._]+\/?$/.test(account.url || '')) err(p, `instagram.account.url 은 계정 주소예요 (${account.url})`);
    else if (!account.handle || !account.url.toLowerCase().replace(/\/$/, '').endsWith('/' + account.handle.toLowerCase())) err(p, 'instagram.account.handle 이 주소의 계정 이름과 달라요');
  }
}

function checkReviewLinks(p) {
  const seen = new Set();
  (p.reviewLinks || []).forEach((r, i) => {
    const at = `reviewLinks[${i}]`;
    if (!isUrl(r.url)) { err(p, `${at}.url 이 URL이 아니에요`); return; }
    if (!r.title) err(p, `${at}.title 이 비었어요`);
    const platform = r.platform ?? hostPlatform(r.url);
    if (!PLATFORMS.has(platform)) err(p, `${at}.platform 은 youtube/instagram/web 중 하나예요 (${r.platform})`);
    else if (platform !== hostPlatform(r.url)) err(p, `${at}.platform(${platform}) 이 주소(${r.url})와 맞지 않아요`);
    if (platform === 'youtube' && !YOUTUBE_URL.test(r.url)) err(p, `${at} 유튜브 주소는 watch?v=영상ID 나 shorts/영상ID 형식으로 써 주세요 (${r.url})`);
    if (platform === 'instagram' && !INSTAGRAM_URL.test(r.url)) err(p, `${at} 인스타그램은 게시물(/p/)이나 릴스(/reel/) 주소만 넣어요 (${r.url})`);
    if (r.kind != null && !KINDS.has(r.kind)) err(p, `${at}.kind 는 review/list 중 하나예요 (${r.kind})`);
    if (r.verdict != null && !VERDICTS.has(r.verdict)) err(p, `${at}.verdict 는 recommend/mixed/negative/null 중 하나예요 (${r.verdict})`);
    if (r.date != null && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(r.date)) err(p, `${at}.date 는 YYYY, YYYY-MM, YYYY-MM-DD 형식이에요 (${r.date})`);
    if (r.note && r.note.length > 60) warn(p, `${at}.note 가 길어요. 원문을 옮기지 말고 한 줄로 직접 요약해 주세요`);
    const key = r.url.replace(/^https?:\/\/(www\.|m\.)?/, '').replace(/\/$/, '');
    if (seen.has(key)) warn(p, `${at} 같은 주소가 두 번 들어 있어요 (${r.url})`);
    seen.add(key);
    if (platform !== 'web') {
      snsLinks++;
      if (r.verdict === 'recommend') snsRecommends++;
    }
  });
}

const ids = new Set();
for (const p of places) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id || '')) err(p, `id는 영문 소문자·숫자·하이픈만 써요 (${p.id})`);
  if (RESERVED.has(p.id) || /^comment-/.test(p.id || '')) err(p, `id ${p.id} 는 쓸 수 없는 이름이에요`);
  if (ids.has(p.id)) err(p, `id가 중복돼요 (${p.id})`);
  ids.add(p.id);
  if (!p.name) err(p, 'name이 비었어요');
  if (!GU.has(p.gu)) err(p, `gu가 서울 자치구 이름이 아니에요 (${p.gu})`);
  if (typeof p.lat !== 'number' || typeof p.lng !== 'number') {
    err(p, 'lat/lng가 숫자가 아니에요');
  } else {
    const at = guAt(p.lng, p.lat);
    if (!at) err(p, `좌표가 서울 밖이에요 (${p.lat}, ${p.lng})`);
    else if (at !== p.gu) warn(p, `좌표가 ${at}에 찍혀요 (적힌 구: ${p.gu}). 구 경계 근처라면 괜찮아요.`);
  }
  if (!GENDERS.has(p.gender)) err(p, `gender는 all/female/male 중 하나예요 (${p.gender})`);
  if (p.schedule) {
    const hm = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!hm.test(p.schedule.open || '') || !hm.test(p.schedule.close || '')) err(p, 'schedule.open/close 는 "HH:MM" 형식이에요');
    if (p.schedule.days && !p.schedule.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) err(p, 'schedule.days 는 0(일)~6(토) 숫자예요');
    if (p.open24h) warn(p, 'open24h 인데 schedule 도 있어요. 하나만 쓰세요.');
  }
  (p.closed || []).forEach((c, i) => {
    if (!(c.weekday >= 0 && c.weekday <= 6) || !(c.nth >= 1 && c.nth <= 5)) err(p, `closed[${i}] 는 { weekday: 0~6, nth: 1~5 } 형식이에요`);
  });
  if (typeof p.open24h !== 'boolean') err(p, 'open24h는 true/false 예요');

  (p.prices || []).forEach((r, i) => {
    if (!PRICE_TYPES.has(r.type)) err(p, `prices[${i}].type 값이 이상해요 (${r.type})`);
    if (!Number.isInteger(r.price) || r.price <= 0 || r.price > 300000) err(p, `prices[${i}].price 값이 이상해요 (${r.price})`);
    if (!r.label) err(p, `prices[${i}].label 이 비었어요`);
  });
  if (!(p.prices || []).length) warn(p, '요금 정보가 없어요');
  if (p.prices && p.prices.length && !p.priceSource) warn(p, '요금 출처(priceSource)가 없어요');
  if (p.priceSource) {
    if (!isUrl(p.priceSource.url)) err(p, 'priceSource.url 이 URL이 아니에요');
    const age = monthsAgo(p.priceSource.date);
    if (age === null) warn(p, '요금 확인 날짜(priceSource.date)가 없어요');
    else if (age > 12) warn(p, `요금 정보가 ${age}개월 전 자료예요. 다시 확인해 주세요.`);
  }

  (p.facilities || []).forEach((k) => { if (!FAC.items[k]) err(p, `모르는 시설 코드: ${k} (data/facilities.json 확인)`); });
  (p.hashtags || []).forEach((t) => { if (/^#|\s/.test(t)) err(p, `해시태그에는 #과 공백을 빼 주세요 (${t})`); });
  checkReviewLinks(p);
  checkInstagram(p);
  if (p.instagramPosts) err(p, 'instagramPosts 는 더 쓰지 않아요. reviewLinks 에 platform: "instagram" 으로 넣어 주세요');
  (p.photos || []).forEach((ph, i) => {
    if (!isUrl(ph.url)) err(p, `photos[${i}].url 이 URL이 아니에요`);
    if (!ph.credit) warn(p, `photos[${i}] 에 저작권 표시(credit)가 없어요`);
  });
}

const approx = places.filter((p) => p.coordsApprox);
if (approx.length) warnings.push(`좌표가 추정값인 곳 ${approx.length}곳 → NAVER_CLIENT_ID/SECRET 을 넣고 scripts/enrich-naver-local.mjs 로 보정하세요`);

if (warnings.length) {
  console.log(`경고 ${warnings.length}개`);
  warnings.forEach((w) => console.log('  - ' + w));
}
if (errors.length) {
  console.error(`오류 ${errors.length}개`);
  errors.forEach((e) => console.error('  ✗ ' + e));
  process.exit(1);
}
console.log(`검사 통과: 찜질방 ${places.length}곳, 유튜브·인스타 링크 ${snsLinks}개 (추천 ${snsRecommends}개), 인스타 위치 태그 페이지 ${igLocations}곳`);
