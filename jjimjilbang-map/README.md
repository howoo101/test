# 서울 찜질방 지도

서울 찜질방의 **요금 · 영업 상태 · 시설 · 후기(유튜브·인스타·블로그) · 길찾기**를 한 화면에서 비교하는 모바일 웹이에요.
화면과 문구는 **토스 UI/UX 디자인 가이드**의 원칙을 따라 만들었어요.

| 항목 | 이 프로젝트에서 쓰는 것 |
| --- | --- |
| 웹 프레임워크 | Vite + React 18 + TypeScript |
| 화면 컴포넌트 | 직접 만든 컴포넌트 `src/ui` (외부 디자인 시스템 패키지 없이 어느 웹에서나 동작) |
| 배포 | Vercel (`vercel.json`) |
| 데이터 | `data/*.json` + 검사기 + GitHub Actions 자동 갱신 |

기획 배경과 화면·데이터 설계는 [docs/기획서.md](docs/기획서.md)에 있어요.

## 1. 개발하기

Node.js 20 이상이 필요해요.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 타입 검사 + 빌드 → dist/
npm run preview    # 빌드한 결과 미리 보기
```

휴대폰 화면 기준이라 브라우저 개발자 도구의 모바일 보기로 확인하는 게 편해요. 넓은 화면에서는 휴대폰 폭(600px)으로 가운데에 보여요.

## 2. Vercel에 올리기

`vercel.json`이 Vercel에 설치(`npm ci`) → 빌드(`npm run build`) → `dist/` 배포를 알려줘요.

- **GitHub 연결:** Vercel에서 이 저장소를 가져오고(Import) **Root Directory를 `jjimjilbang-map`** 으로 지정해요. 그다음부터는 main에 push할 때마다 자동으로 배포되고, PR마다 미리보기 주소가 생겨요.
- **명령어로:** `npx vercel --cwd jjimjilbang-map` (미리보기), `npx vercel --cwd jjimjilbang-map --prod` (실서비스)
- Vercel 프로젝트에 **Deployment Protection(Vercel Authentication)** 이 켜져 있으면 로그인한 팀원만 볼 수 있어요. 누구나 보게 하려면 Settings → Deployment Protection에서 꺼요.

## 3. 화면 원칙 (토스 UI/UX 디자인 가이드)

- **한 화면에 하나의 목적:** 홈은 찾기(검색·필터·지도/목록), 상세는 한 곳 살펴보기(요금 → 후기 평가 → 기본 정보 → 시설 → 길찾기)예요.
- **크게, 넉넉하게:** 큰 굵은 제목, 넓은 여백, 회색 단계와 파랑 하나만 쓰는 색, 둥근 모서리.
- **다음 행동은 하나로:** 상세 화면 아래에 "네이버 지도로 길찾기" 버튼 하나를 고정해요. 정렬처럼 고르는 일은 바텀시트로, 결과는 토스트로 짧게 알려요.
- **문구:** 해요체로, 짧게, 필요 없는 말은 빼고, 다음에 할 일을 알려줘요. 예: "찜 목록에 담았어요", "위치 권한을 허용하면 가까운 찜질방을 보여드려요".

`src/ui/index.tsx`에 화면 조각이 모여 있어요: `Top`(화면 제목), `ListRow`·`ListHeader`·`TableRow`(목록), `SearchField`, `Chip`, `SegmentedControl`, `Badge`, `Button`, `TextButton`, `FixedBottomCTA`(하단 고정 버튼), `BottomSheet`, 토스트(`ToastProvider`, `useToast`).

## 4. 기기 기능

모든 기기 기능은 `src/lib/device.ts`에 모여 있고 브라우저 기능만 써요.

| 기능 | 쓰는 것 |
| --- | --- |
| 내 위치·가까운순 정렬 | 브라우저 위치(Geolocation). 위치는 기기 안에서 거리 계산에만 쓰고 저장하지 않아요 |
| 찜 목록 저장 | 브라우저 저장소(localStorage) |
| 공유 | 휴대폰 공유 시트(Web Share). 없으면 주소 복사. 공유 주소 `?place=장소id`로 들어오면 그 찜질방 상세가 바로 열려요 |
| 주소·전화번호 복사 | 클립보드 |
| 네이버 지도·블로그·유튜브·인스타 열기 | 새 탭 |
| 네이버 지도 길찾기 (하단 버튼) | **현재 위치에서 출발**해요. 휴대폰: 네이버 지도 앱 주소 `nmap://route/public?…`(출발지를 비우면 앱이 현재 위치를 넣어요). 앱이 없으면 네이버 지도 웹 길찾기로. 컴퓨터: 브라우저 위치를 받아 네이버 지도 웹 길찾기 주소 `map.naver.com/p/directions/{출발}/{도착}/-/transit`의 출발지("내 위치")에 넣어 새 탭으로 열어요. 위치를 못 받으면 출발지만 비워 둬요 |

## 5. 지도

- 기본은 **간이 지도**예요. 외부 지도 키 없이 서울 25개 구 경계, 한강, 주요 지하철역을 그려요.
- 네이버 지도를 쓰려면 `VITE_NAVER_MAP_KEY_ID=발급받은_Client_ID`를 `.env`(Vercel은 Environment Variables)에 넣어요. NCP 콘솔의 Maps 애플리케이션에 서비스 주소(예: Vercel 도메인, `http://localhost:5173`)를 등록해야 지도가 떠요. 인증에 실패하면 간이 지도로 자동으로 바뀌어요.

## 6. 찜질방 정보 고치기·추가하기

장소 정보는 `data/places.json`에 있어요. 고친 뒤에는 검사기를 돌리세요 (push·PR 때 GitHub Actions도 같은 검사를 해요).

```bash
npm run validate
```

네이버 검색 API 키가 있으면 블로그 후기·이미지와 좌표를 자동으로 채울 수 있어요.

검색 API는 developers.naver.com 에서 NAVER API HUB(네이버 클라우드 플랫폼 콘솔)로 옮겨졌어요. 콘솔에서 **NAVER API HUB → Application 등록**을 하고 **블로그·이미지·지역 검색**을 고른 뒤 나오는 Client ID / Client Secret 을 넣으면 돼요. 스크립트는 API HUB 주소(`naverapihub.apigw.ntruss.com`)를 기본으로 쓰고, 예전 developers.naver.com 키라면 `NAVER_API=devcenter` 를 함께 넣어요.

```bash
NAVER_CLIENT_ID=아이디 NAVER_CLIENT_SECRET=시크릿 npm run naver:content   # data/naver-content.json
NAVER_CLIENT_ID=아이디 NAVER_CLIENT_SECRET=시크릿 npm run naver:enrich    # 좌표·전화번호 비교표 (--write 로 반영)
```

유튜브 영상도 자동으로 모을 수 있어요. Google Cloud 콘솔에서 **YouTube Data API v3** 키를 만들어 넣어요 (하루 무료 10,000단위, 72곳 검색에 약 7,200단위).

```bash
YOUTUBE_API_KEY=키 npm run youtube   # data/youtube-content.json
```

이 스크립트는 `reviewLinks`에 넣은 추천 영상도 확인해요. 비어 있는 채널 이름과 올린 날짜를 채우고, 지워졌거나 비공개로 바뀐 영상은 화면과 추천순에서 빼요.

저장소 **Settings → Secrets and variables → Actions**에 같은 이름(`NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `YOUTUBE_API_KEY`)으로 넣으면 매주 월요일 새벽 후기와 영상이 자동으로 갱신돼요. API 한도를 아끼려고 오래된 곳만 다시 받아요(네이버: 7일 지난 곳 최대 80곳, 유튜브: 25일 지난 곳 최대 30곳). 전부 다시 받으려면 Actions에서 Run workflow 할 때 "all"을 켜거나 스크립트에 `--all` 을 붙여요. 키는 앱 코드에 절대 넣지 마세요.

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
├── vercel.json              Vercel 빌드 설정
├── vite.config.ts
├── index.html
├── src/
│   ├── main.tsx             토스트 + 앱 상태
│   ├── AppContext.tsx       찜 · 내 위치 · 토스트
│   ├── App.tsx              홈 ↔ 상세 전환 (#장소id, ?place=장소id)
│   ├── ui/                  토스 UI/UX 디자인 가이드 스타일 컴포넌트
│   ├── pages/HomePage.tsx   검색·필터 칩·지도/목록·정렬
│   ├── pages/PlacePage.tsx  상세 (상단 바·요금표·후기 평가·기본 정보·시설·길찾기)
│   ├── components/          지도, 목록 줄, 아이콘
│   ├── lib/data.ts          데이터 정리·영업 상태·후기 평가·추천순·필터
│   ├── lib/device.ts        위치·공유·복사·저장·외부 링크·길찾기
│   └── lib/map/             간이 지도(SVG)·네이버 지도 어댑터
├── data/                    places.json, facilities.json, naver-content.json, youtube-content.json, seoul-geo.json, seoul-stations.json
├── scripts/                 데이터 검사, 네이버 검색 API·YouTube Data API 수집
└── docs/기획서.md
```

## 데이터 출처와 주의

- 찜질방 정보는 2026년 11월 공개 자료(기사, 여행 가이드, 후기)로 정리했어요. 장소마다 출처와 날짜가 `priceSource`, `reviewLinks`에 있어요.
- 요금과 운영 시간은 자주 바뀌어요. 화면에도 "방문 전 확인" 안내를 넣었어요.
- 지도 위치는 아직 추정값이에요. 네이버 지역 검색 스크립트로 보정하세요.
- 구 경계: 통계청 2013 센서스 경계 ([southkorea/seoul-maps](https://github.com/southkorea/seoul-maps))
