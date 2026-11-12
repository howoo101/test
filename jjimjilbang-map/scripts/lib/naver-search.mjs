// 네이버 검색 API 호출 도우미
// - 기본: NAVER API HUB (네이버 클라우드). 개발자센터의 검색 API 신규 발급이 끝나 이쪽으로 옮겨졌어요.
//   주소 https://naverapihub.apigw.ntruss.com/search/v1/{blog|image|local}
//   헤더 X-NCP-APIGW-API-KEY-ID / X-NCP-APIGW-API-KEY (콘솔에서 만든 애플리케이션의 Client ID / Client Secret)
// - 예전 개발자센터 키를 쓰려면 NAVER_API=devcenter 를 함께 넣어요 (openapi.naver.com).
// - 검색 API는 하루 25,000회까지예요. 키는 GitHub Actions 비밀값에만 넣고 브라우저 코드에는 넣지 않아요.
import { sleep } from './datafile.mjs';

const DEVCENTER = process.env.NAVER_API === 'devcenter';
const BASE = DEVCENTER ? 'https://openapi.naver.com/v1/search/' : 'https://naverapihub.apigw.ntruss.com/search/v1/';
const authHeaders = (cred) => (DEVCENTER
  ? { 'X-Naver-Client-Id': cred.id, 'X-Naver-Client-Secret': cred.secret }
  : { 'X-NCP-APIGW-API-KEY-ID': cred.id, 'X-NCP-APIGW-API-KEY': cred.secret });

export function credentials() {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) {
    console.error('NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 환경변수가 필요해요.');
    console.error('발급: 네이버 클라우드 콘솔 → NAVER API HUB → 애플리케이션 등록 → 블로그·이미지·지역 검색 선택');
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
  const path = DEVCENTER ? kind : kind.replace(/\.json$/, '');
  const url = BASE + path + '?' + new URLSearchParams(params).toString();
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      headers: authHeaders(cred)
    });
    if (res.ok) return res.json();
    const body = await res.text();
    if (res.status === 429 && attempt < 3) { await sleep(1000 * attempt); continue; }
    throw new Error(`네이버 ${kind} 검색 실패 (${res.status}): ${body.slice(0, 200)}`);
  }
  return null;
}
