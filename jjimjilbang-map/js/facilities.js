/*
 * 시설 코드 사전.
 * data/places.js 의 facilities 배열에는 아래 key(영문 코드)만 씁니다.
 * 새 시설을 추가하려면 여기에 한 줄 추가하고, scripts/validate-data.mjs 를 돌려 확인하세요.
 */
window.JJIM_FACILITIES = {
  groups: [
    { id: 'heat', label: '찜질' },
    { id: 'bath', label: '목욕' },
    { id: 'rest', label: '휴식' },
    { id: 'amenity', label: '편의' }
  ],
  items: {
    bulgama:     { label: '불가마·한증막', short: '불가마', group: 'heat', icon: '🔥' },
    hwangto:     { label: '황토방', short: '황토방', group: 'heat', icon: '🟫' },
    salt:        { label: '소금방', short: '소금방', group: 'heat', icon: '🧂' },
    charcoal:    { label: '숯가마·참숯방', short: '숯가마', group: 'heat', icon: '🪵' },
    ice:         { label: '얼음방', short: '얼음방', group: 'heat', icon: '🧊' },
    jade:        { label: '보석·광물방', short: '보석방', group: 'heat', icon: '💎' },
    pyeonbaek:   { label: '편백방·산림욕', short: '편백방', group: 'heat', icon: '🌲' },

    bath:        { label: '대중탕·사우나', short: '사우나', group: 'bath', icon: '🛁' },
    outdoor:     { label: '노천탕·야외탕', short: '노천탕', group: 'bath', icon: '♨️' },
    pool:        { label: '수영장·워터파크', short: '수영장', group: 'bath', icon: '🏊' },
    seshin:      { label: '세신(때밀이)', short: '세신', group: 'bath', icon: '🧽' },

    sleep:       { label: '수면실', short: '수면실', group: 'rest', icon: '😴' },
    femaleSleep: { label: '여성 전용 수면실', short: '여성수면실', group: 'rest', icon: '🌙' },
    capsule:     { label: '개인실·수면캡슐', short: '개인실', group: 'rest', icon: '🛏️' },
    rooftop:     { label: '루프탑·야외 휴게', short: '루프탑', group: 'rest', icon: '🌇' },
    movie:       { label: '영화·미디어룸', short: '영화관', group: 'rest', icon: '🎬' },
    comics:      { label: '만화·북카페', short: '만화방', group: 'rest', icon: '📚' },

    food:        { label: '식당·스낵바', short: '식당', group: 'amenity', icon: '🍜' },
    cafe:        { label: '카페', short: '카페', group: 'amenity', icon: '☕' },
    pc:          { label: 'PC존', short: 'PC존', group: 'amenity', icon: '💻' },
    gym:         { label: '헬스장', short: '헬스', group: 'amenity', icon: '🏋️' },
    massage:     { label: '마사지', short: '마사지', group: 'amenity', icon: '💆' },
    kids:        { label: '키즈존·놀이방', short: '키즈존', group: 'amenity', icon: '🧸' },
    karaoke:     { label: '노래방', short: '노래방', group: 'amenity', icon: '🎤' },
    parking:     { label: '주차 가능', short: '주차', group: 'amenity', icon: '🅿️' }
  },
  // 목록 상단 필터 칩으로 노출할 시설 (순서대로)
  quickFilters: ['bulgama', 'outdoor', 'pool', 'sleep', 'femaleSleep', 'hwangto', 'salt', 'ice', 'charcoal', 'seshin', 'kids', 'parking'],
  // 사진이 없을 때 목록 썸네일·상세 표지에 보여줄 대표 시설 우선순위
  signature: ['pool', 'outdoor', 'charcoal', 'bulgama', 'pyeonbaek', 'hwangto', 'salt', 'ice', 'jade', 'capsule', 'rooftop', 'kids', 'comics', 'seshin', 'bath']
};
