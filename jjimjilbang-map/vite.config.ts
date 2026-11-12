import aitDevtools from '@apps-in-toss/devtools/unplugin';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 앱인토스 미니앱은 번들 폴더(dist)를 그대로 올리므로 자산 경로를 상대 경로로 둡니다.
// aitDevtools: 브라우저에서 토스 앱 SDK를 흉내 내는 공식 개발 도구예요.
//  - npm run dev            : mock SDK + AIT 패널 (배포 번들에는 들어가지 않아요)
//  - npm run build          : 실제 배포용 (mock 없음) → dist/ → ait build → .ait
//  - npm run build:preview  : 브라우저 공유용 미리보기 (mock SDK 포함, 패널 없음) → preview-dist/
export default defineConfig(({ mode }) => {
  const preview = mode === 'preview';
  return {
    base: './',
    plugins: [
      aitDevtools.vite(preview ? { forceEnable: true, mock: true, panel: false } : {}),
      react({ jsxImportSource: '@emotion/react' }),
    ],
    build: {
      outDir: preview ? 'preview-dist' : 'dist',
      target: 'es2019',
      chunkSizeWarningLimit: 1600,
    },
  };
});
