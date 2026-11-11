/*
 * 서울 찜질방 지도 설정 파일
 *
 * NAVER_MAP_KEY_ID
 *   네이버 클라우드 플랫폼(NCP) 콘솔 > Application Services > Maps 에서
 *   Application을 등록하면 받는 "Client ID"(=Key ID)를 넣으세요.
 *   - Web 서비스 URL에 이 페이지 주소를 꼭 등록해야 지도가 열립니다.
 *     예) http://127.0.0.1:5500, http://localhost:5500, https://<github아이디>.github.io
 *   - 비워 두면 네이버 지도 대신 간이 지도(서울 구 경계)로 보여줍니다.
 *   - 이 값은 브라우저에 그대로 노출되는 값이라 괜찮습니다(도메인으로 보호됨).
 *     반대로 네이버 "검색 API"의 Client Secret은 절대 여기에 넣지 마세요.
 *
 * FEEDBACK_URL
 *   "정보가 달라요" 버튼이 여는 주소. 구글폼, 깃허브 이슈 등으로 바꿔 쓰세요.
 */
window.JJIM_CONFIG = {
  NAVER_MAP_KEY_ID: '',
  FEEDBACK_URL: 'https://github.com/howoo101/test/issues/new?title=%5B%EC%A0%95%EB%B3%B4%EC%88%98%EC%A0%95%5D%20',
  // 지도 처음 위치 (서울시청 근처)
  START_CENTER: { lat: 37.5465, lng: 126.99 },
  START_ZOOM: 11
};
