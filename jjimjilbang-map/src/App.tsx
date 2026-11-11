import { useCallback, useEffect, useRef, useState } from 'react';
import { BY_ID } from './lib/data';
import { initialPlaceId } from './lib/toss';
import { HomePage } from './pages/HomePage';
import { PlacePage } from './pages/PlacePage';

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

  useEffect(() => {
    const onPop = () => setPlaceId(hashId());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (placeId) window.scrollTo(0, 0);
    else window.scrollTo(0, homeScroll.current);
  }, [placeId]);

  const openPlace = useCallback((id: string) => {
    homeScroll.current = window.scrollY;
    history.pushState({ place: id }, '', `#${id}`);
    setPlaceId(id);
  }, []);

  const closePlace = useCallback(() => {
    if ((history.state as { place?: string } | null)?.place) {
      history.back();
    } else {
      history.replaceState(null, '', location.pathname + location.search);
      setPlaceId(null);
    }
  }, []);

  return (
    <>
      <div hidden={!!placeId}>
        <HomePage onOpen={openPlace} active={!placeId} />
      </div>
      {placeId && <PlacePage key={placeId} place={BY_ID[placeId]} onBack={closePlace} />}
    </>
  );
}
