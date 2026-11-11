# 서울 찜질방 지도

서울 찜질방의 **요금 · 시설 · 후기 · 사진**을 네이버 지도 위에서 한 번에 비교하는 웹 지도예요.

- 지도 핀에 어른 찜질 최저 요금이 바로 보여요 (`1.4만` 같은 식)
- 요금표(주간·야간·주말·소인), 시설 25종, 후기 요약, 네이버 블로그 후기, 인스타그램 해시태그, 사진 바로가기를 상세 화면 하나에 모았어요
- 모든 요금에 출처와 기준 날짜를 붙였어요
- 휴대폰에서는 지도 + 끌어올리는 바텀시트로 동작해요

기획 배경, 화면 설계, 데이터 수집 정책은 [docs/기획서.md](docs/기획서.md)에 있어요.

## 1. 바로 실행해 보기

빌드 과정이 없어요. 아무 웹 서버로 이 폴더를 열면 됩니다.

- **VS Code:** `index.html`을 열고 오른쪽 아래 **Go Live**(Live Server 확장) 클릭 → `http://127.0.0.1:5500/jjimjilbang-map/`
- **터미널:** `cd jjimjilbang-map && python3 -m http.server 5500` → `http://localhost:5500`

네이버 지도 키를 넣기 전에는 서울 구 경계로 그린 **간이 지도**로 보여요. 기능은 모두 똑같이 동작해요.

## 2. 네이버 지도 연결하기

1. [네이버 클라우드 플랫폼](https://www.ncloud.com)에 가입하고 콘솔에 들어가요. (결제수단 등록이 필요할 수 있어요)
2. **Services → Application Services → Maps** 에서 **Application 등록**을 눌러요.
3. API는 **Dynamic Map**을 고르고, **Web 서비스 URL**에 이 페이지를 열 주소를 모두 넣어요.
   - `http://127.0.0.1:5500`, `http://localhost:5500` (내 컴퓨터)
   - `https://<깃허브아이디>.github.io` (GitHub Pages로 공개할 때)
4. 만들어진 앱의 **Client ID**를 복사해 `js/config.js`의 `NAVER_MAP_KEY_ID`에 붙여 넣어요.

```js
window.JJIM_CONFIG = {
  NAVER_MAP_KEY_ID: '여기에_Client_ID',
  ...
};
```

- 스크립트 주소는 `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=...` 예요. 옛 예제의 `ncpClientId`는 2025년 신규 Maps 상품부터 `ncpKeyId`로 바뀌었어요.
- Client ID는 브라우저에 보여도 괜찮아요. 등록한 주소에서만 동작해요.
- 인증에 실패하면 화면 위에 안내가 뜨고 간이 지도로 바뀌어요. 키와 Web 서비스 URL을 다시 확인하세요.
- NCP 콘솔에서 월 사용 한도를 걸어 두면 요금 걱정이 없어요.

## 3. 네이버 블로그 후기·사진 자동으로 채우기

네이버 검색 API(하루 25,000회 무료)로 장소마다 블로그 후기와 이미지를 모아 `data/naver-content.js`에 저장해요.

1. [네이버 개발자센터](https://developers.naver.com/apps/#/register)에서 애플리케이션을 등록하고 사용 API로 **검색**을 골라요.
2. 발급된 Client ID와 Client Secret으로 실행해요. (Node.js 18 이상)

```bash
cd jjimjilbang-map
NAVER_CLIENT_ID=아이디 NAVER_CLIENT_SECRET=시크릿 npm run naver:content   # 블로그 후기·이미지
NAVER_CLIENT_ID=아이디 NAVER_CLIENT_SECRET=시크릿 npm run naver:enrich    # 좌표·전화번호 비교표
NAVER_CLIENT_ID=아이디 NAVER_CLIENT_SECRET=시크릿 node scripts/enrich-naver-local.mjs --write  # 좌표 반영
```

**매일 자동으로 돌리기:** 저장소 **Settings → Secrets and variables → Actions**에 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`을 등록하면 `.github/workflows/jjimjilbang-map.yml`이 매일 새벽(한국시간 03:17) 후기를 갱신해 커밋해요. 예약 실행은 기본 브랜치(main)에 합쳐진 뒤부터 돌아가요.

> Client Secret은 절대 `js/config.js`나 다른 브라우저 코드에 넣지 마세요.

## 4. 찜질방 정보 고치기·추가하기

모든 장소 정보는 `data/places.js` 한 파일에 있어요. 고친 뒤에는 꼭 검사기를 돌리세요.

```bash
npm run validate     # node scripts/validate-data.mjs
```

검사기는 형식 오류, 모르는 시설 코드, 좌표가 적힌 구 밖에 찍히는지, 12개월 넘은 요금 정보를 알려줘요. push와 PR에서도 GitHub Actions가 같은 검사를 해요.

새 장소를 추가할 때 체크리스트:

- [ ] `id`는 영문 소문자와 하이픈 (`sparex-dongmyo`)
- [ ] 요금마다 `type`(찜질/목욕/기타), `who`(대인/소인…), `price`(정수)
- [ ] `priceSource`에 출처 URL과 기준 날짜 (`2026-11`)
- [ ] `facilities`는 `js/facilities.js`에 있는 코드만
- [ ] 후기 요약(`highlights`, `cons`)은 원문을 복사하지 말고 직접 요약
- [ ] 사진(`photos`)은 직접 찍었거나 허락받은 것만, `credit` 표시
- [ ] 네이버 지도에서 장소를 열었을 때 주소의 `/place/숫자`를 `naverPlaceId`에 넣으면 사진·리뷰 탭으로 바로 연결돼요

## 5. 인터넷에 공개하기 (GitHub Pages)

1. 이 브랜치를 main에 합쳐요.
2. 저장소 **Settings → Pages → Build and deployment**에서 Source를 **Deploy from a branch**, 브랜치를 `main` / `(root)`로 저장해요.
3. 몇 분 뒤 `https://<깃허브아이디>.github.io/<저장소이름>/jjimjilbang-map/` 에서 열려요.
4. NCP Maps의 Web 서비스 URL에 `https://<깃허브아이디>.github.io`를 꼭 추가하세요.

## 폴더 구조

```
jjimjilbang-map/
├── index.html              화면 뼈대
├── css/style.css           디자인 (라이트/다크 모드)
├── js/config.js            네이버 지도 키, 제보 링크
├── js/facilities.js        시설 코드 사전 (25종)
├── js/app.js               검색·필터·목록·상세·바텀시트
├── js/map-naver.js         네이버 지도 어댑터
├── js/map-fallback.js      간이 지도 어댑터 (SVG)
├── data/places.js          찜질방 데이터 ← 사람이 관리
├── data/naver-content.js   네이버 후기·이미지 ← 스크립트가 생성
├── data/seoul-geo.js       서울 25개 구 경계 + 한강
├── scripts/                검사·수집 스크립트
└── docs/기획서.md
```

## 데이터 출처와 주의

- 장소 정보는 2026년 11월 공개 자료(기사, 여행 가이드, 후기)로 정리했어요. 장소마다 출처와 날짜가 `priceSource`, `reviewLinks`에 있어요.
- 요금과 운영 시간은 자주 바뀌어요. 화면에도 "방문 전 확인" 안내를 넣었어요.
- 지도 위치는 아직 추정값이에요. 3번의 지역 검색 스크립트로 보정하세요.
- 구 경계: 통계청 2013 센서스 경계 ([southkorea/seoul-maps](https://github.com/southkorea/seoul-maps))
