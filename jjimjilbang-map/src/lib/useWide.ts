import { useEffect, useState } from 'react';

/** 컴퓨터처럼 넓은 화면(가로 1024px 이상)이면 true: 네이버 지도처럼 왼쪽 목록·상세 + 오른쪽 큰 지도로 보여줘요 */
export const WIDE_QUERY = '(min-width: 1024px)';

export function useWide() {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}
