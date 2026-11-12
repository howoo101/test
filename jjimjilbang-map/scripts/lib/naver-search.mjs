// 네이버 검색 API (developers.naver.com) 호출 도우미
// - 블로그/이미지/지역 검색은 하루 25,000회까지 무료입니다.
// - Client Secret은 서버나 GitHub Actions 비밀값에서만 쓰세요. 브라우저 코드에 넣으면 안 됩니다.
import { sleep } from './datafile.mjs';

const BASE = 'https://openapi.naver.com/v1/search/';

export function credentials() {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) {
    console.error('NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 환경변수가 필요해요.');
    console.error('발급: https://developers.naver.com/apps 에서 애플리케이션 등록 → 검색 API 선택');
    process.exit(2);
  }
  return { id, secret };
}

let last = 0;
export async function search(kind, params, cred) {
  // 초당 호출 수 제한을 넘지 않도록 간격을 둡니다.
  const wait = 120 - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const url = BASE + kind + '?' + new URLSearchParams(params).toString();
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': cred.id, 'X-Naver-Client-Secret': cred.secret }
    });
    if (res.ok) return res.json();
    const body = await res.text();
    if (res.status === 429 && attempt < 3) { await sleep(1000 * attempt); continue; }
    throw new Error(`네이버 ${kind} 검색 실패 (${res.status}): ${body.slice(0, 200)}`);
  }
  return null;
}
