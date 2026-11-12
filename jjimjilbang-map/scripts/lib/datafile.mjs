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
