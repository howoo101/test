import { useCallback, useEffect, useRef, useState } from 'react';
import { BY_ID } from './lib/data';
import { initialPlaceId } from './lib/device';
import { HomePage } from './pages/HomePage';
import { PlacePage } from './pages/PlacePage';
import { useWide } from './lib/useWide';

// 화면은 두 개예요: 홈(지도·목록)과 찜질방 상세.
// 주소 해시(#장소id)로 상세를 열어 뒤로 가기가 자연스럽게 동작해요. 홈은 상태(필터·지도 위치)를 지키려고 숨겨만 둬요.
const hashId = () => {
  const id = decodeURIComponent(location.hash.replace(/^#/, ''));
  return BY_ID[id] ? id : null;
};

export function App() {
  const [placeId, setPlaceId] = useState<string | null>(() => {
    const id = initialPlaceId();
    return id && BY_ID[id] ? id : null;
  });
  const homeScroll = useRef(0);
  const wide = useWide();

  useEffect(() => {
    const onPop = () => setPlaceId(hashId());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    // 넓은 화면은 목록·상세가 각자 스크롤해요
    if (wide) return;
    if (placeId) window.scrollTo(0, 0);
    else window.scrollTo(0, homeScroll.current);
  }, [placeId, wide]);

  const openPlace = useCallback((id: string) => {
    homeScroll.current = window.scrollY;
    // 넓은 화면에서 상세를 연 채로 다른 곳을 고르면 뒤로 가기 기록을 쌓지 않고 바꿔요
    if ((history.state as { place?: string } | null)?.place) history.replaceState({ place: id }, '', `#${id}`);
    else history.pushState({ place: id }, '', `#${id}`);
    setPlaceId(id);
  }, []);

  const closePlace = useCallback(() => {
    if ((history.state as { place?: string } | null)?.place) {
      history.back();
    } else {
      // 공유 주소(?place=…)로 들어왔다면 주소에서 지워서, 새로고침해도 홈으로 열리게 해요.
      history.replaceState(null, '', location.pathname);
      setPlaceId(null);
    }
  }, []);

  const detail = placeId ? <PlacePage key={placeId} place={BY_ID[placeId]} onBack={closePlace} wide={wide} /> : null;
  return (
    <>
      <div hidden={!wide && !!placeId}>
        <HomePage onOpen={openPlace} active={wide || !placeId} wide={wide} openId={placeId} detail={wide ? detail : null} />
      </div>
      {!wide && detail}
    </>
  );
}
