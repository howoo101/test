// data/*.js 파일은 브라우저에서 바로 쓰도록 `window.이름 = {...};` 형태입니다.
// Node 스크립트에서는 vm으로 실행해 값을 꺼내고, JSON으로 다시 씁니다.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const file = (...p) => path.join(ROOT, ...p);

export function readWindowVar(filePath, name) {
  const code = fs.readFileSync(filePath, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { filename: filePath });
  if (!(name in sandbox.window)) throw new Error(`${filePath} 에 window.${name} 가 없어요`);
  return sandbox.window[name];
}

export function readHeader(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const code = fs.readFileSync(filePath, 'utf8');
  const m = code.match(/^\/\*[\s\S]*?\*\/\n/);
  return m ? m[0] : '';
}

export function writeWindowVar(filePath, name, data) {
  const header = readHeader(filePath);
  fs.writeFileSync(filePath, header + `window.${name} = ` + JSON.stringify(data, null, 2) + ';\n');
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
