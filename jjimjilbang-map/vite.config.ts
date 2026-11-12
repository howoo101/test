import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 정적 웹사이트로 빌드해요 (npm run build → dist/). Vercel 은 vercel.json 설정대로 같은 명령을 돌려요.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2019',
  },
});
