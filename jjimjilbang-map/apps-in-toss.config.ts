import { defineConfig } from '@apps-in-toss/web-framework/config';

// 앱인토스 콘솔에 등록한 앱 이름과 같아야 해요.
// permissions: 검수 때 사용하는 권한 목록이에요. 실제로 쓰는 기능만 적어요.
//  - geolocation: "내 주변 찜질방"·가까운순 정렬에 현재 위치를 써요.
//  - clipboard(write): 주소·전화번호 복사 버튼에 써요.
export default defineConfig({
  appName: 'seoul-jjimjilbang-map',
  permissions: [
    { name: 'geolocation', access: 'access' },
    { name: 'clipboard', access: 'write' },
  ],
  webBundleDir: 'dist',
});
