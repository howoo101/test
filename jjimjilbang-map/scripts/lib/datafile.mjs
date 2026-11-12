// data/*.json 읽기·쓰기 도우미 (앱은 Vite가 같은 JSON을 그대로 import 해요)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const file = (...p) => path.join(ROOT, ...p);

export function readJson(filePath, fallback) {
  if (fallback !== undefined && !fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 네이버 검색 API 응답의 <b> 태그와 HTML 엔티티를 지웁니다.
export function stripTags(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

export const norm = (s) => String(s || '').toLowerCase().replace(/[\s·()\-_.]/g, '');

/**
 * API 한도를 아끼려고 이번에 다시 받을 장소만 골라요.
 * - 마지막으로 받은 지 days 일이 안 지난 곳은 건너뛰어요.
 * - 오래된 곳(한 번도 안 받은 곳 먼저)부터 max 곳까지만 받아요.
 * 명령줄: --days N, --max N, --all(날짜·개수 제한 없이 전부), --only 장소id
 */
export function pickStale(places, lastFetched, { days, max }) {
  const args = process.argv.slice(2);
  const val = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
  const only = val('--only');
  if (only) return places.filter((p) => p.id === only);
  if (args.includes('--all')) return places;
  const d = Number(val('--days') ?? process.env.REFRESH_DAYS ?? days);
  const m = Number(val('--max') ?? process.env.REFRESH_MAX ?? max);
  const today = Date.now();
  const age = (p) => {
    const t = lastFetched(p.id);
    return t ? (today - Date.parse(t)) / 86400000 : Infinity;
  };
  const due = places.filter((p) => age(p) >= d).sort((a, b) => age(b) - age(a));
  const pick = due.slice(0, m);
  console.log(`이번에 받을 곳 ${pick.length}곳 (받은 지 ${d}일 넘은 곳 ${due.length}곳 중 최대 ${m}곳, 나머지는 다음 실행에)`);
  return pick;
}
