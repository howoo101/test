import type { ReactNode } from 'react';
import { getAppsInTossGlobals } from '@apps-in-toss/web-framework';
import { TDSMobileProvider } from '@toss/tds-mobile';
import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';

// 토스 앱(또는 개발용 mock SDK)이 있으면 공식 앱인토스 TDS Provider를 써요.
// 일반 브라우저에서 SDK 없이 열면(배포 번들을 그냥 연 경우) 기본 TDS Provider로 대신 그려요.
function canUseAitProvider() {
  try {
    getAppsInTossGlobals();
    return true;
  } catch {
    return false;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  if (canUseAitProvider()) {
    return <TDSMobileAITProvider>{children}</TDSMobileAITProvider>;
  }
  const ua = navigator.userAgent;
  return (
    <TDSMobileProvider
      userAgent={{
        fontA11y: undefined,
        fontScale: undefined,
        isAndroid: /Android/i.test(ua),
        isIOS: /iPhone|iPad|iPod/i.test(ua),
        colorPreference: 'light',
      }}
    >
      {children}
    </TDSMobileProvider>
  );
}
