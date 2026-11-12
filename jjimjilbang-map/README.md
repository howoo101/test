# 서울 찜질방 지도 — 앱인토스 미니앱

서울 찜질방의 **요금 · 영업 상태 · 시설 · 후기 · 사진 바로가기**를 한 화면에서 비교하는 토스 미니앱이에요.
[앱인토스 개발자 가이드](https://developers-apps-in-toss.toss.im/)의 **WebView 방식**을 그대로 따라 만들었어요.

| 항목 | 이 프로젝트에서 쓰는 것 |
| --- | --- |
| 웹 프레임워크 | Vite + React 18 + TypeScript |
| 앱인토스 SDK | `@apps-in-toss/web-framework` 3.x (설정 파일 `apps-in-toss.config.ts`) |
| 디자인 시스템 | TDS — `@toss/tds-mobile`, `@toss/tds-mobile-ait` (`TDSMobileAITProvider`) |
| 개발 도구 | `@apps-in-toss/devtools` — 브라우저에서 SDK를 흉내 내는 공식 mock + AIT 패널 |
| 빌드 결과 | `ait build` → `seoul-jjimjilbang-map.ait` (콘솔에 올리는 파일) |

기획 배경과 화면·데이터 설계, 정책 검토는 [docs/기획서.md](docs/기획서.md)에 있어요.

## 1. 준비

- Node.js **24 이상**을 권장해요 (`@apps-in-toss/devtools`와 `.ait` 포맷 도구가 Node 24를 요구해요).
- 처음 한 번 `npm install`

## 2. 브라우저에서 개발하기

```bash
npm run dev        # http://localhost:5173
```

- 토스 앱이 없어도 공식 mock SDK가 위치·저장소·공유 같은 기능을 흉내 내요.
- 화면 오른쪽 아래 **AIT** 버튼을 누르면 패널이 열려요. 위치 권한 거부, 내 위치 좌표, 기기 화면(내비게이션 바 포함) 같은 상황을 바꿔 가며 확인할 수 있어요.
- 휴대폰 화면 기준이라 브라우저 개발자 도구의 모바일 보기로 확인하는 게 편해요.

## 3. 앱인토스 콘솔에 앱 등록하고 휴대폰에서 확인하기

1. 앱인토스 콘솔에서 미니앱을 만들고 **앱 이름을 `seoul-jjimjilbang-map`** 으로 등록해요. 이름을 바꾸려면 `apps-in-toss.config.ts`의 `appName`과 `src/lib/toss.ts`의 `APP_NAME`도 같이 바꿔요. 표시 이름과 아이콘은 콘솔에서 정해요.
2. 아래 4번처럼 빌드해서 올리면 그 버전을 여는 `intoss-private://` 주소가 출력돼요. 콘솔 안내에 따라 휴대폰에서 열어 확인해요. 개발 서버를 샌드박스 앱에 바로 붙이는 방법은 개발자센터의 WebView 튜토리얼을 따라요.
3. 휴대폰에서 콘솔 로그를 봐야 하면 `@apps-in-toss/debugger`와 `@apps-in-toss/debug-console`을 써요 (devtools 패키지 README에 안내가 있어요).

## 4. 빌드하고 배포하기

```bash
npm run build      # 타입 검사 → vite build → ait build → seoul-jjimjilbang-map.ait
npm run deploy     # ait deploy (콘솔에서 발급한 API 키가 필요해요)
```

- API 키는 `npx ait token add`로 한 번 저장해 두면 다음부터 묻지 않아요.
- 업로드한 뒤 콘솔에서 **검수**를 요청해요. 요청 전에 콘솔의 **비게임 출시 가이드 체크리스트**를 꼭 확인하세요.
- `.ait` 파일은 커밋하지 않아요 (`.gitignore`에 있어요).

## 5. 토스 앱 밖에서 보여줄 미리보기 만들기

```bash
npm run build:preview   # preview-dist/ — 공식 mock SDK를 넣어 일반 브라우저에서도 동작
```

실제 배포 번들(`dist/`)은 토스 앱 밖에서 열면 SDK 대신 웹 기능(브라우저 위치, localStorage 등)으로 동작하도록 만들어 두었어요.

## 6. 토스 SDK를 쓰는 곳

모든 SDK 호출은 `src/lib/toss.ts` 한 파일에 모여 있어요. 토스 앱 밖에서는 같은 함수가 웹 API로 대신 동작해요.

| 기능 | SDK | 권한(`apps-in-toss.config.ts`) |
| --- | --- | --- |
| 내 위치·가까운순 정렬 | `Device.getLocation` (거부하면 `openPermissionDialog`로 다시 요청) | `geolocation` |
| 주소·전화번호 복사 | `Clipboard.setText` | `clipboard` (write) |
| 공유 | `Share.createLink` (`intoss://seoul-jjimjilbang-map?place=장소id`) + `Share.sendMessage` | — |
| 찜 목록 저장 | `Storage.getItem` / `Storage.setItem` | — |
| 네이버 지도·블로그·유튜브·인스타 열기 | `Device.openURL` | — |
| 네이버 지도 길찾기 (하단 버튼) | `Device.openURL('nmap://route/public?…')` → 네이버 지도 앱이 현재 위치에서 대중교통 길찾기를 열어요. 앱이 없으면 네이버 지도 웹의 장소 화면으로 | — |
| 가벼운 진동 | `Device.triggerHaptic` | — |
| 상세 화면에서 뒤로 가기 | `graniteEvent`의 `backEvent` | — |

공유 링크로 들어오면 `?place=장소id`를 읽어 바로 그 찜질방 상세를 열어요.

## 7. 지도

- 기본은 **간이 지도**예요. 외부 지도 키 없이 서울 25개 구 경계, 한강, 주요 지하철역을 그려요.
- 네이버 지도를 쓰려면 프로젝트 폴더에 `.env` 파일을 만들고 `VITE_NAVER_MAP_KEY_ID=발급받은_Client_ID` 를 넣어요.
- ⚠️ 미니앱 안에서 외부 지도 API를 쓸 수 있는지는 **지도 제공사와 앱인토스 정책을 먼저 확인**하세요. 카카오맵은 "토스 앱 안의 서비스에는 입점사 자체 앱 키를 쓸 수 없다"고 답한 사례가 있어요. 그래서 기본값을 간이 지도로 두었어요.

## 8. 찜질방 정보 고치기·추가하기

장소 정보는 `data/places.json`에 있어요. 고친 뒤에는 검사기를 돌리세요 (push·PR 때 GitHub Actions도 같은 검사를 해요).

```bash
npm run validate
```

네이버 검색 API(하루 25,000회 무료) 키가 있으면 블로그 후기·이미지와 좌표를 자동으로 채울 수 있어요.

```bash
NAVER_CLIENT_ID=아이디 NAVER_CLIENT_SECRET=시크릿 npm run naver:content   # data/naver-content.json
NAVER_CLIENT_ID=아이디 NAVER_CLIENT_SECRET=시크릿 npm run naver:enrich    # 좌표·전화번호 비교표 (--write 로 반영)
```

유튜브 영상도 자동으로 모을 수 있어요. Google Cloud 콘솔에서 **YouTube Data API v3** 키를 만들어 넣어요 (하루 무료 10,000단위, 17곳 검색에 약 1,700단위).

```bash
YOUTUBE_API_KEY=키 npm run youtube   # data/youtube-content.json
```

이 스크립트는 `reviewLinks`에 넣은 추천 영상도 확인해요. 비어 있는 채널 이름과 올린 날짜를 채우고, 지워졌거나 비공개로 바뀐 영상은 화면과 추천순에서 빼요.

저장소 **Settings → Secrets and variables → Actions**에 같은 이름(`NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `YOUTUBE_API_KEY`)으로 넣으면 매일 새벽 후기와 영상이 자동으로 갱신돼요. 키는 앱 코드에 절대 넣지 마세요.

### 유튜브·인스타 추천 넣기

장소의 `reviewLinks`에 글·영상 하나씩 넣어요. 평가(`verdict`)가 있는 링크가 **후기 평가**와 **추천순**에 들어가요.

```json
{
  "title": "서울 3대 찜질방! 리얼 숯가마 사우나 …",
  "url": "https://www.youtube.com/watch?v=영상ID",
  "source": "유튜브",
  "date": "2025-02",
  "platform": "youtube",
  "kind": "review",
  "author": "채널 이름",
  "verdict": "recommend",
  "note": "서울 3대 숯가마 찜질방으로 꼽고 이용법 소개"
}
```

| 필드 | 값 |
| --- | --- |
| `platform` | `youtube` · `instagram` · `web`(블로그·기사·여행 가이드·스레드). 비우면 주소로 판단 |
| `kind` | `review`(그곳만 다룬 후기) · `list`(여러 곳을 묶은 추천 모음) |
| `verdict` | `recommend` 추천 · `mixed` 장단점 · `negative` 아쉬움 · `null` 판단 근거 없음 |
| `note` | 그 글·영상이 이 장소에 대해 한 말을 **직접** 한 줄로 요약 (원문 복사 금지) |
| `sponsored` | 협찬·광고 표시가 있으면 `true` (추천순에서 절반만 반영) |

- 유튜브 주소는 `watch?v=영상ID`나 `shorts/영상ID` 형식, 인스타그램은 게시물(`/p/`)이나 릴스(`/reel/`) 주소만 넣어요. 검사기가 형식을 확인해요.
- 인스타그램 게시물은 검색 엔진에 거의 잡히지 않고, 공식 해시태그 검색 API는 메타 앱 심사가 필요해요. 인스타그램 앱에서 게시물의 **링크 복사**로 얻은 주소를 넣으면 돼요.

장소마다 인스타그램 **위치 태그 페이지**와 **공식 계정**도 넣을 수 있어요.

```json
"instagram": {
  "location": { "url": "https://www.instagram.com/explore/locations/숫자/이름/", "posts": 516, "checkedAt": "2026-11" },
  "account": { "url": "https://www.instagram.com/계정이름/", "handle": "계정이름", "followers": 2922 }
}
```

- `location`: 그 장소를 태그한 게시물을 모두 모아 보여주는 인스타그램 화면이에요. 후기 평가의 인스타그램 칸에 "이 장소를 태그한 게시물 516개"로 나와요. 게시물 수는 추천순의 화제성 점수(최대 1점)에 들어가요.
- `account`: 업체 공식 계정이에요. 홍보 글이라 평가와 점수에는 넣지 않아요.
- 평가는 제목과 소개에 드러난 내용으로만 나눠요. 애매하면 `null`로 둬요.

**추천순은 이렇게 정해요** (`src/lib/data.ts`의 `reviewScore`)

- 링크 하나마다 `출처 가중치 × 평가 점수 × 최신성`을 더해요. 출처 가중치는 유튜브 1.2, 인스타그램 1, 블로그·기사 0.8이에요.
- 평가 점수는 추천 1, 장단점 0.3, 아쉬움 -1, 판단 근거 없음 0.2예요.
- 최신성은 1년 안이면 1, 2년 안이면 0.8, 4년 안이면 0.5, 그보다 오래되면 0.3, 날짜를 모르면 0.4예요.
- 묶음 글(`list`)은 0.8배, 협찬(`sponsored`)은 0.5배로 줄여서 더해요.
- 여기에 정보 신뢰도(높음 1, 보통 0.5)와 화제성 점수를 더해요. 화제성은 네이버 블로그 글 수와 인스타그램 위치 태그 게시물 수로 매기고, 각각 최대 1점이에요 (10개 0.25, 100개 0.5, 1,000개 0.75, 10,000개 이상 1).

새 장소를 넣을 때 확인할 것:

- [ ] `id`는 영문 소문자와 하이픈 (`sparex-dongmyo`)
- [ ] 요금마다 `type`(찜질/목욕/기타), `who`(대인/소인…), `price`(정수)와 `priceSource`(출처 URL, 기준 날짜)
- [ ] `facilities`는 `data/facilities.json`에 있는 코드만
- [ ] 후기 요약(`highlights`, `cons`)은 원문을 복사하지 말고 직접 요약
- [ ] 유튜브·인스타·블로그 후기는 `reviewLinks`에 평가(`verdict`)와 함께
- [ ] 사진(`photos`)은 직접 찍었거나 허락받은 것만, `credit` 표시

## 폴더 구조

```
jjimjilbang-map/
├── apps-in-toss.config.ts   앱 이름·권한·번들 폴더 (ait init 형식)
├── vite.config.ts           React + 앱인토스 devtools 플러그인
├── index.html
├── src/
│   ├── main.tsx             TDS Provider + 앱 상태
│   ├── App.tsx              홈 ↔ 상세 화면 전환 (#장소id)
│   ├── pages/HomePage.tsx   검색·필터 칩·지도/목록·정렬
│   ├── pages/PlacePage.tsx  상세 (요금표·기본 정보·시설·후기·하단 버튼)
│   ├── components/          지도, 목록 줄, 아이콘
│   └── lib/
│       ├── data.ts          데이터 정리·영업 상태·필터
│       ├── toss.ts          앱인토스 SDK 호출 (브라우저 대체 포함)
│       └── map/             간이 지도(SVG)·네이버 지도 어댑터
├── data/                    places.json, facilities.json, naver-content.json, youtube-content.json, seoul-geo.json, seoul-stations.json
├── scripts/                 데이터 검사, 네이버 검색 API·YouTube Data API 수집
└── docs/기획서.md
```

## 데이터 출처와 주의

- 찜질방 정보는 2026년 11월 공개 자료(기사, 여행 가이드, 후기)로 정리했어요. 장소마다 출처와 날짜가 `priceSource`, `reviewLinks`에 있어요.
- 요금과 운영 시간은 자주 바뀌어요. 화면에도 "방문 전 확인" 안내를 넣었어요.
- 지도 위치는 아직 추정값이에요. 네이버 지역 검색 스크립트로 보정하세요.
- TDS는 토스가 앱인토스 파트너에게 제공하는 디자인 시스템이에요. 앱인토스 미니앱 용도로 쓰세요.
- 구 경계: 통계청 2013 센서스 경계 ([southkorea/seoul-maps](https://github.com/southkorea/seoul-maps))
