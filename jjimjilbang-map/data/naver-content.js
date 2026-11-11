/*
 * 네이버 검색 API로 모은 블로그 후기·이미지 (자동 생성 파일, 직접 고치지 마세요)
 * 만드는 법: NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... node scripts/fetch-naver-content.mjs
 * 형식: byPlace[장소 id] = { blogTotal, blog: [{title, link, description, bloggername, postdate}], images: [{title, link, thumbnail}] }
 */
window.JJIM_NAVER = {
  "updatedAt": null,
  "byPlace": {}
};
