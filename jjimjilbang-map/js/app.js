/*
 * 서울 찜질방 지도 - 앱 로직
 * 데이터: window.JJIM_DATA (data/places.js), window.JJIM_NAVER (data/naver-content.js)
 * 지도: 네이버 지도(map-naver.js) 또는 간이 지도(map-fallback.js) — 두 어댑터는 같은 메서드를 가집니다.
 * 화면 구성은 네이버 지도 웹·앱의 익숙한 패턴(목록 옆 상세 패널, 떠 있는 검색창, 바텀시트)을 따릅니다.
 */
(function () {
  'use strict';

  const CFG = window.JJIM_CONFIG || {};
  const FAC = window.JJIM_FACILITIES;
  const DATA = window.JJIM_DATA || { places: [] };
  const NAVER = window.JJIM_NAVER || { byPlace: {} };
  const ICON = window.JJIM_ICON;
  const CHILD_RE = /소인|어린이|아동|청소년|유아|초등|미취학/;
  const ADULT_WHO = ['대인', '성인', '공통'];
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

  // ---------------------------------------------------------------- utils
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => n.toLocaleString('ko-KR');
  const won = (n) => num(n) + '원';
  const normText = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');
  const mq = window.matchMedia('(max-width: 859px)');
  const isMobile = () => mq.matches;
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? u : '#');
  const telHref = (phone) => 'tel:' + String(phone).replace(/[^0-9+]/g, '');

  function shortWon(n) {
    if (n % 1000 !== 0) return num(n);
    if (n < 10000) return n / 1000 + '천';
    return Math.round(n / 1000) / 10 + '만';
  }

  function distanceKm(a, b) {
    const R = 6371, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  const fmtDist = (km) => (km < 1 ? Math.round(km * 1000) + 'm' : km.toFixed(1) + 'km');

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 저장할 수 없는 환경 */ }
    }
  };

  // 한국 시간 기준 현재 요일·시각 (보는 사람의 시간대와 상관없이)
  function kstNow() {
    const parts = {};
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach((x) => { parts[x.type] = x.value; });
    return {
      wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday),
      day: Number(parts.day),
      minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute)
    };
  }
  let NOW = kstNow();
  const toMin = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };

  // ---------------------------------------------------------------- data
  // who 값이 있으면 그것으로, 없으면 라벨 글자로 어른 요금인지 판단합니다.
  function isAdult(r) { return r.who ? ADULT_WHO.indexOf(r.who) >= 0 : !CHILD_RE.test(r.label || ''); }

  function normalize(p, index) {
    const prices = (p.prices || []).filter((r) => typeof r.price === 'number' && r.price > 0);
    const jjim = prices.filter((r) => (r.type || '찜질') === '찜질' && isAdult(r));
    const base = jjim.length ? jjim : prices.filter(isAdult);
    return Object.assign({}, p, {
      index,
      prices,
      facilities: p.facilities || [],
      hashtags: p.hashtags || [],
      highlights: p.highlights || [],
      cons: p.cons || [],
      priceRows: base,
      minPrice: base.length ? Math.min.apply(null, base.map((r) => r.price)) : null,
      haystack: normText([p.name, p.nameEn, (p.aliases || []).join(' '), p.gu, p.address, p.station, p.category, (p.hashtags || []).join(' ')].join(' '))
    });
  }

  const PLACES = (DATA.places || []).map(normalize);
  const BY_ID = {};
  PLACES.forEach((p) => { BY_ID[p.id] = p; });

  const naverInfo = (p) => (NAVER.byPlace && NAVER.byPlace[p.id]) || null;
  const category = (p) => p.category || '찜질방';

  function naverPlaceUrl(p, tab) {
    if (p.naverPlaceId) return 'https://m.place.naver.com/place/' + encodeURIComponent(p.naverPlaceId) + '/' + (tab || 'home');
    return 'https://map.naver.com/p/search/' + encodeURIComponent(p.naverQuery || p.name);
  }
  const naverBlogSearchUrl = (p) => 'https://search.naver.com/search.naver?where=blog&query=' + encodeURIComponent((p.naverQuery || p.name) + ' 후기');
  const naverImageSearchUrl = (p) => 'https://search.naver.com/search.naver?where=image&query=' + encodeURIComponent(p.naverQuery || p.name);
  const instaTagUrl = (tag) => 'https://www.instagram.com/explore/tags/' + encodeURIComponent(String(tag).replace(/^#/, '')) + '/';

  function openStatus(p) {
    const hol = (p.closed || []).find((c) => c.weekday === NOW.wd && Math.ceil(NOW.day / 7) === c.nth);
    if (hol) return { key: 'closed', text: '오늘 휴무', sub: (hol.label || '정기') + ' 휴무' };
    if (p.open24h) return { key: 'open', text: '영업 중', sub: '24시간 영업' };
    const s = p.schedule;
    if (!s) return { key: 'unknown', text: '영업시간 확인 필요', sub: '' };
    if (s.days && s.days.indexOf(NOW.wd) < 0) {
      return { key: 'closed', text: '오늘 휴무', sub: s.note || s.days.map((d) => WEEK[d]).join('·') + '요일만 운영' };
    }
    const o = toMin(s.open), c = toMin(s.close), m = NOW.minutes;
    const isOpen = c > o ? (m >= o && m < c) : (m >= o || m < c);
    if (isOpen) {
      const left = (c - m + 1440) % 1440;
      return { key: left <= 60 ? 'closing' : 'open', text: left <= 60 ? '곧 영업 종료' : '영업 중', sub: s.close + '에 영업 종료' };
    }
    return { key: 'closed', text: m < o ? '영업 전' : '영업 종료', sub: s.open + '에 영업 시작' };
  }

  function reviewInfo(p) {
    const nv = naverInfo(p);
    if (nv && nv.blogTotal) return { label: '블로그 리뷰 ' + num(nv.blogTotal) };
    const n = (p.reviewLinks || []).length;
    return { label: n ? '후기 ' + n : '' };
  }

  function photoList(p) {
    if (p.photos && p.photos.length) {
      return p.photos.map((ph) => ({ src: safeUrl(ph.url), alt: p.name + ' ' + (ph.caption || '사진'), credit: ph.credit || '', link: null }));
    }
    const nv = naverInfo(p);
    if (nv && nv.images && nv.images.length) {
      return nv.images.map((im) => ({ src: safeUrl(im.thumbnail), alt: im.title || p.name, credit: '', link: safeUrl(im.link) }));
    }
    return [];
  }

  function signature(p, n) {
    const first = FAC.signature.filter((k) => p.facilities.indexOf(k) >= 0);
    const rest = p.facilities.filter((k) => first.indexOf(k) < 0 && FAC.items[k]);
    return first.concat(rest).slice(0, n);
  }

  // ---------------------------------------------------------------- state
  const state = {
    q: '',
    chips: new Set(),
    gu: '',
    maxPrice: 0,
    sort: 'rec',
    bounds: null,
    selectedId: null,
    favs: new Set(store.get('jjim:favs', [])),
    userPos: null,
    sheet: 'peek'
  };
  let mapApi = null;
  let lastMarkerClick = 0;
  let suppressViewUntil = 0;
  let listScrollTop = 0;

  const els = {
    app: $('#app'),
    head: $('#panelHead'),
    searchForm: $('#searchForm'),
    q: $('#q'),
    qClear: $('#qClear'),
    chips: $('#chips'),
    panel: $('#panel'),
    sheetTop: $('#sheetTop'),
    grip: $('#sheetGrip'),
    gu: $('#fGu'),
    price: $('#fPrice'),
    sort: $('#fSort'),
    count: $('#count'),
    reset: $('#reset'),
    body: $('#panelBody'),
    list: $('#list'),
    empty: $('#empty'),
    detail: $('#detail'),
    mapWrap: $('#mapWrap'),
    map: $('#map'),
    areaSearch: $('#areaSearch'),
    notice: $('#mapNotice'),
    toast: $('#toast'),
    railList: $('#railList'),
    railFav: $('#railFav'),
    mcLocate: $('#mcLocate'),
    mcZoomIn: $('#mcZoomIn'),
    mcZoomOut: $('#mcZoomOut'),
    mcFit: $('#mcFit')
  };

  function programmatic(fn) {
    suppressViewUntil = Date.now() + 900;
    fn();
  }

  // ---------------------------------------------------------------- filters
  const CHIP_DEFS = [
    { id: 'open', label: '영업 중' },
    { id: 'open24h', label: '24시간' },
    { id: 'fav', label: '찜', icon: 'heart' },
    { id: 'female', label: '여성전용' }
  ].concat(FAC.quickFilters.map((k) => ({ id: k, label: FAC.items[k].short })));

  function renderChips() {
    const items = [];
    if (state.bounds) {
      items.push('<button type="button" class="chip chip-area" data-chip="__area" aria-pressed="true" aria-label="지도 영역 필터 해제">' +
        ICON('map') + '지도 영역' + ICON('close') + '</button>');
    }
    CHIP_DEFS.forEach((c) => {
      items.push('<button type="button" class="chip" data-chip="' + c.id + '" aria-pressed="' + state.chips.has(c.id) + '">' +
        (c.icon ? ICON(c.icon) : '') + esc(c.label) + '</button>');
    });
    els.chips.innerHTML = items.join('');
    els.railFav.setAttribute('aria-pressed', String(state.chips.has('fav')));
  }

  function toggleChip(id) {
    if (state.chips.has(id)) state.chips.delete(id); else state.chips.add(id);
    renderChips();
    refresh();
  }

  function bindFilters() {
    els.chips.addEventListener('click', (e) => {
      const b = e.target.closest('[data-chip]');
      if (!b) return;
      if (b.dataset.chip === '__area') { state.bounds = null; renderChips(); refresh(); return; }
      toggleChip(b.dataset.chip);
    });
    // 마우스 휠로 칩 줄을 가로로 스크롤
    els.chips.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || els.chips.scrollWidth <= els.chips.clientWidth) return;
      els.chips.scrollLeft += e.deltaY;
      e.preventDefault();
    }, { passive: false });

    const guCounts = {};
    PLACES.forEach((p) => { guCounts[p.gu] = (guCounts[p.gu] || 0) + 1; });
    els.gu.innerHTML = '<option value="">전체 지역</option>' + Object.keys(guCounts).sort((a, b) => a.localeCompare(b, 'ko'))
      .map((g) => '<option value="' + esc(g) + '">' + esc(g) + ' ' + guCounts[g] + '</option>').join('');
    els.gu.addEventListener('change', () => { state.gu = els.gu.value; refresh({ fit: true }); });
    els.price.addEventListener('change', () => { state.maxPrice = Number(els.price.value) || 0; refresh(); });

    if (PLACES.some((p) => naverInfo(p) && naverInfo(p).blogTotal)) {
      const opt = document.createElement('option');
      opt.value = 'reviews';
      opt.textContent = '리뷰 많은순';
      els.sort.appendChild(opt);
    }
    els.sort.addEventListener('change', () => {
      state.sort = els.sort.value;
      if (state.sort === 'near' && !state.userPos) locate({ pan: false });
      refresh();
    });

    let t = 0;
    els.q.addEventListener('input', () => {
      els.qClear.hidden = !els.q.value;
      clearTimeout(t);
      t = setTimeout(() => { state.q = els.q.value.trim(); refresh({ fit: !!state.q }); }, 160);
    });
    els.searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const first = filtered()[0];
      els.q.blur();
      if (first) location.hash = first.id;
    });
    els.qClear.addEventListener('click', () => {
      els.q.value = '';
      els.qClear.hidden = true;
      state.q = '';
      refresh({ fit: true });
      els.q.focus();
    });
    els.reset.addEventListener('click', resetFilters);
  }

  function resetFilters() {
    state.q = ''; els.q.value = ''; els.qClear.hidden = true;
    state.chips.clear();
    state.gu = ''; els.gu.value = '';
    state.maxPrice = 0; els.price.value = '';
    state.bounds = null;
    els.areaSearch.hidden = true;
    renderChips();
    refresh({ fit: true });
  }

  const filtersActive = () => !!(state.q || state.chips.size || state.gu || state.maxPrice || state.bounds);

  function matches(p) {
    if (state.q && !p.haystack.includes(normText(state.q))) return false;
    if (state.gu && p.gu !== state.gu) return false;
    if (state.maxPrice && !(p.minPrice && p.minPrice <= state.maxPrice)) return false;
    if (state.bounds && !state.bounds.contains(p.lat, p.lng)) return false;
    for (const c of state.chips) {
      if (c === 'fav') { if (!state.favs.has(p.id)) return false; }
      else if (c === 'open') { const k = openStatus(p).key; if (k !== 'open' && k !== 'closing') return false; }
      else if (c === 'open24h') { if (!p.open24h) return false; }
      else if (c === 'female') { if (p.gender !== 'female') return false; }
      else if (p.facilities.indexOf(c) < 0) return false;
    }
    return true;
  }

  function filtered() {
    const list = PLACES.filter(matches);
    const byIndex = (a, b) => a.index - b.index;
    if (state.sort === 'price') list.sort((a, b) => (a.minPrice || Infinity) - (b.minPrice || Infinity) || byIndex(a, b));
    else if (state.sort === 'near' && state.userPos) list.sort((a, b) => distanceKm(state.userPos, a) - distanceKm(state.userPos, b));
    else if (state.sort === 'reviews') {
      const total = (p) => (naverInfo(p) && naverInfo(p).blogTotal) || 0;
      list.sort((a, b) => total(b) - total(a) || byIndex(a, b));
    } else list.sort(byIndex);
    return list;
  }

  // ---------------------------------------------------------------- list
  const shortDays = (d) => (d === '주말·공휴일' ? '주말' : d);

  function priceLine(p) {
    if (!p.priceRows.length) return '<p class="card-prices is-missing">요금 확인 중</p>';
    const rows = p.priceRows.slice(0, 3);
    const shared = rows.length > 1 && rows.every((r) => r.label === rows[0].label);
    const parts = rows.map((r) => {
      const lead = [shared ? '' : r.label, r.days && r.days !== '전체' ? shortDays(r.days) : ''].filter(Boolean).join(' ');
      return (lead ? esc(lead) + ' ' : '') + '<b>' + won(r.price) + '</b>';
    });
    return '<p class="card-prices">' + parts.join('<span class="sep">|</span>') + '</p>';
  }

  function tagList(p) {
    const tags = [];
    if (p.alert) tags.push('<li class="tag tag-warn">' + esc(p.alert) + '</li>');
    if (p.confidence === 'low') tags.push('<li class="tag tag-warn">정보 확인 필요</li>');
    if (p.gender === 'female') tags.push('<li class="tag tag-female">여성전용</li>');
    const fac = p.facilities.filter((k) => FAC.items[k] && (FAC.items[k].group !== 'amenity' || k === 'parking' || k === 'kids'));
    fac.slice(0, 4).forEach((k) => tags.push('<li class="tag">' + esc(FAC.items[k].short) + '</li>'));
    if (p.facilities.length > 4) tags.push('<li class="tag">+' + (p.facilities.length - Math.min(fac.length, 4)) + '</li>');
    return '<ul class="card-tags" aria-label="주요 시설">' + tags.join('') + '</ul>';
  }

  function thumbHtml(p) {
    const photos = photoList(p);
    if (photos.length) {
      return '<span class="thumb"><img src="' + esc(photos[0].src) + '" alt="" loading="lazy" referrerpolicy="no-referrer"></span>';
    }
    const k = signature(p, 1)[0];
    const f = k ? FAC.items[k] : null;
    return '<span class="thumb tone-' + (f ? f.group : 'amenity') + '" aria-hidden="true">' +
      '<span class="thumb-ico">' + (f ? f.icon : '♨') + '</span><span class="thumb-lbl">' + esc(f ? f.short : '찜질방') + '</span></span>';
  }

  function statusLine(p, withDistance) {
    const st = openStatus(p);
    const parts = ['<b class="st-' + st.key + '">' + esc(st.text) + '</b>'];
    if (st.sub) parts.push(esc(st.sub));
    const rv = reviewInfo(p);
    if (rv.label) parts.push(esc(rv.label));
    if (withDistance && state.userPos) parts.push(fmtDist(distanceKm(state.userPos, p)));
    return parts.join('<span class="dot">·</span>');
  }

  function favButton(id, cls) {
    const on = state.favs.has(id);
    return '<button type="button" class="fav ' + cls + '" data-fav="' + esc(id) + '" aria-pressed="' + on + '" aria-label="찜하기" title="찜하기">' + ICON('heart') + '</button>';
  }

  function renderList(list) {
    els.count.innerHTML = list.length === PLACES.length
      ? '찜질방 <em>' + list.length + '</em>곳'
      : '<em>' + list.length + '</em>곳 <span class="muted">/ 전체 ' + PLACES.length + '</span>';
    els.reset.hidden = !filtersActive();
    els.empty.hidden = list.length > 0;
    els.list.innerHTML = list.map((p) =>
      '<li class="item' + (p.id === state.selectedId ? ' is-active' : '') + '">' +
        '<a class="card" href="#' + esc(p.id) + '" data-id="' + esc(p.id) + '">' +
          '<div class="card-main">' +
            '<div class="card-title"><span class="card-name">' + esc(p.name) + '</span><span class="card-cat">' + esc(category(p)) + '</span></div>' +
            '<div class="card-status">' + statusLine(p, true) + '</div>' +
            '<div class="card-meta">' + esc([p.gu, p.station].filter(Boolean).join(' · ')) + '</div>' +
            priceLine(p) +
            tagList(p) +
          '</div>' +
          thumbHtml(p) +
        '</a>' +
        favButton(p.id, 'card-fav') +
      '</li>'
    ).join('');
  }

  function toggleFav(id) {
    if (state.favs.has(id)) state.favs.delete(id); else state.favs.add(id);
    store.set('jjim:favs', Array.from(state.favs));
    if (mapApi) mapApi.refreshPin(id);
    const on = state.favs.has(id);
    document.querySelectorAll('[data-fav="' + CSS.escape(id) + '"]').forEach((b) => b.setAttribute('aria-pressed', String(on)));
    toast(on ? '찜 목록에 담았어요' : '찜 목록에서 뺐어요');
    refresh();
  }

  // ---------------------------------------------------------------- detail
  const TABS = [['home', '홈'], ['price', '요금'], ['facility', '시설'], ['review', '리뷰'], ['photo', '사진']];
  const copyBtn = (text) => '<button type="button" class="mini" data-copy="' + esc(text) + '">' + ICON('copy') + '복사</button>';

  function coverHtml(p) {
    const photos = photoList(p);
    const photoUrl = naverPlaceUrl(p, 'photo');
    if (photos.length) {
      const shown = photos.slice(0, 3);
      const cols = shown.length === 1 ? ' style="grid-template-columns:1fr"' : shown.length === 2 ? ' style="grid-template-rows:1fr"' : '';
      return '<div class="cover"' + cols + '>' + shown.map((ph, i) =>
        '<a class="' + (i === 0 && shown.length === 3 ? 'c-main' : '') + '" href="' + esc(ph.link || photoUrl) + '" target="_blank" rel="noopener noreferrer">' +
        '<img src="' + esc(ph.src) + '" alt="' + esc(ph.alt) + '" loading="lazy" referrerpolicy="no-referrer">' +
        (i === shown.length - 1 && photos.length > shown.length ? '<span class="cover-more">+' + (photos.length - shown.length) + '</span>' : '') +
        '</a>').join('') + '</div>';
    }
    const tiles = signature(p, 2).map((k) =>
      '<span class="cover-tile tone-' + FAC.items[k].group + '" aria-hidden="true"><span class="big">' + FAC.items[k].icon + '</span>' + esc(FAC.items[k].short) + '</span>');
    while (tiles.length < 2) tiles.push('<span class="cover-tile tone-amenity" aria-hidden="true"><span class="big">♨</span>' + esc(p.gu) + '</span>');
    return '<div class="cover">' +
      '<a class="c-main tile-brand" href="' + esc(photoUrl) + '" target="_blank" rel="noopener">' +
        '<span class="tile-mark" aria-hidden="true">♨</span><span class="tile-cta">' + ICON('camera') + '<span class="cta-long">네이버 지도에서 </span>사진 보기</span></a>' +
      tiles.join('') + '</div>';
  }

  function headPrice(p) {
    if (!p.priceRows.length) return '<p class="d-price">요금 확인 중</p>';
    const rows = p.priceRows.slice(0, 3).map((r) => {
      const lead = [r.label, r.days && r.days !== '전체' ? shortDays(r.days) : ''].filter(Boolean).join(' ');
      return esc(lead) + ' <b>' + won(r.price) + '</b>';
    });
    return '<p class="d-price">' + rows.join('<span class="dot">·</span>') + '</p>';
  }

  function homeBlock(p) {
    const st = openStatus(p);
    const rows = [];
    if (p.address) {
      rows.push(['pin', esc(p.address) + ' ' + copyBtn(p.address) + (p.station ? '<span class="sub">' + esc(p.station) + '</span>' : '')]);
    }
    rows.push(['clock', '<b class="st-' + st.key + '">' + esc(st.text) + '</b>' + (st.sub ? ' · ' + esc(st.sub) : '') +
      (p.hours ? '<span class="sub">' + esc(p.hours) + '</span>' : '')]);
    if (p.phone) rows.push(['phone', '<a href="' + esc(telHref(p.phone)) + '">' + esc(p.phone) + '</a> ' + copyBtn(p.phone)]);
    rows.push(['users', p.gender === 'female' ? '여성 전용' : p.gender === 'male' ? '남성 전용' : '남녀 모두 이용 (탕은 따로)']);
    if (p.minPrice) {
      rows.push(['tag', '어른 찜질 <b>' + won(p.minPrice) + '</b>부터 <button type="button" class="mini" data-tab="price">요금표</button>']);
    }
    const amen = p.facilities.filter((k) => FAC.items[k] && FAC.items[k].group === 'amenity').map((k) => FAC.items[k].short);
    if (amen.length) rows.push(['list', '편의시설 · ' + esc(amen.join(', '))]);
    return '<ul class="info">' + rows.map((r) => '<li>' + ICON(r[0]) + '<div class="val">' + r[1] + '</div></li>').join('') + '</ul>';
  }

  function priceBlock(p) {
    if (!p.prices.length) return '<p class="muted">아직 확인된 요금이 없어요. 방문 전 전화로 확인해 주세요.</p>';
    const groups = {};
    p.prices.forEach((r) => { const t = r.type || '찜질'; (groups[t] = groups[t] || []).push(r); });
    const titles = { '찜질': '찜질 이용 (찜질 + 목욕)', '목욕': '목욕·사우나만', '기타': '기타 요금' };
    const html = ['찜질', '목욕', '기타'].filter((t) => groups[t]).map((t) =>
      '<div class="pgroup"><p class="pgroup-title">' + titles[t] + '</p><ul class="plist">' +
      groups[t].map((r) => {
        const sub = [r.days && r.days !== '전체' ? r.days : '', r.time || '', r.note || ''].filter(Boolean).join(' · ');
        return '<li><div><span class="p-name">' + esc(r.label) + (r.who && r.who !== '공통' ? '<span class="who">' + esc(r.who) + '</span>' : '') + '</span>' +
          (sub ? '<span class="p-sub">' + esc(sub) + '</span>' : '') + '</div><span class="p-price">' + won(r.price) + '</span></li>';
      }).join('') + '</ul></div>').join('');
    const inc = p.includes || [];
    const extra = p.extraFees || [];
    const extras = inc.length || extra.length
      ? '<div class="extras">' +
        (inc.length ? '<p><span class="xlabel">요금에 포함</span>' + inc.map(esc).join(', ') + '</p>' : '') +
        (extra.length ? '<p><span class="xlabel">추가 요금</span>' + extra.map((x) => esc(x.label) + ' ' + (typeof x.price === 'number' ? won(x.price) : esc(x.price))).join(', ') + '</p>' : '') +
        '</div>'
      : '';
    const src = p.priceSource && p.priceSource.url
      ? '<p class="fineprint">출처: <a href="' + esc(safeUrl(p.priceSource.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(p.priceSource.label || '원문') + '</a>' +
        (p.priceSource.date ? ' (' + esc(p.priceSource.date) + ' 기준)' : '') + ' · 현장 요금과 다를 수 있어요.</p>'
      : '';
    return html + extras + (p.priceNote ? '<p class="fineprint">' + esc(p.priceNote) + '</p>' : '') + src;
  }

  function facilitiesBlock(p) {
    if (!p.facilities.length) return '<p class="muted">시설 정보를 확인하고 있어요.</p>';
    return FAC.groups.map((g) => {
      const items = p.facilities.filter((k) => FAC.items[k] && FAC.items[k].group === g.id);
      if (!items.length) return '';
      return '<div class="fgroup"><p class="fgroup-title">' + esc(g.label) + '</p><ul class="fgrid">' +
        items.map((k) => '<li class="fitem"><span class="ficon" aria-hidden="true">' + FAC.items[k].icon + '</span>' + esc(FAC.items[k].label) + '</li>').join('') +
        '</ul></div>';
    }).join('') + (p.facilityNotes ? '<p class="fnote">' + esc(p.facilityNotes) + '</p>' : '');
  }

  function reviewBlock(p) {
    let html = '';
    if (p.highlights.length) html += '<h4>이런 점이 좋았어요</h4><ul class="kw">' + p.highlights.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul>';
    if (p.cons.length) html += '<h4>이런 점은 아쉬워요</h4><ul class="kw kw-bad">' + p.cons.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul>';
    if (html) html += '<p class="fineprint">블로그·기사 후기를 읽고 직접 요약했어요.</p>';

    const nv = naverInfo(p);
    const fromApi = !!(nv && nv.blog && nv.blog.length);
    const items = fromApi
      ? nv.blog.slice(0, 6).map((b) => ({ title: b.title, url: b.link, meta: [b.bloggername, b.postdate].filter(Boolean).join(' · '), text: b.description }))
      : (p.reviewLinks || []).map((r) => ({ title: r.title, url: r.url, meta: [r.source, r.date].filter(Boolean).join(' · ') }));
    html += '<h4>' + (fromApi ? '네이버 블로그 리뷰' + (nv.blogTotal ? ' ' + num(nv.blogTotal) : '') : '블로그·기사 후기') + '</h4>';
    html += items.length
      ? '<ul class="rlist">' + items.map((r) =>
        '<li><a href="' + esc(safeUrl(r.url)) + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="rtitle">' + esc(r.title) + '</span>' +
        (r.text ? '<span class="rtext">' + esc(r.text) + '</span>' : '') +
        '<span class="rmeta">' + esc(r.meta) + '</span></a></li>').join('') + '</ul>'
      : '<p class="muted">모아 둔 후기가 아직 없어요.</p>';
    html += '<div class="linkrow">' +
      '<a class="lbtn" href="' + esc(naverBlogSearchUrl(p)) + '" target="_blank" rel="noopener">네이버 블로그 후기 더 보기' + ICON('external') + '</a>' +
      '<a class="lbtn" href="' + esc(naverPlaceUrl(p, 'review/visitor')) + '" target="_blank" rel="noopener">네이버 방문자 리뷰' + ICON('external') + '</a>' +
      '</div>';

    html += '<h4>인스타그램</h4>';
    const posts = p.instagramPosts || [];
    if (posts.length) {
      html += '<div class="insta-posts">' + posts.map((u) =>
        '<blockquote class="instagram-media" data-instgrm-permalink="' + esc(safeUrl(u)) + '" data-instgrm-version="14">' +
        '<a href="' + esc(safeUrl(u)) + '" target="_blank" rel="noopener">인스타그램 게시물 보기</a></blockquote>').join('') + '</div>';
    }
    html += p.hashtags.length
      ? '<div class="linkrow">' + p.hashtags.map((t) => '<a class="lbtn lbtn-tag" href="' + esc(instaTagUrl(t)) + '" target="_blank" rel="noopener">#' + esc(t) + '</a>').join('') + '</div>'
      : '<p class="muted">등록된 해시태그가 없어요.</p>';
    return html;
  }

  function photoBlock(p) {
    const photos = photoList(p);
    const tag = p.hashtags[0];
    let html = '';
    if (photos.length) {
      html += '<div class="gallery">' + photos.slice(0, 12).map((ph) =>
        (ph.link
          ? '<a class="ph" href="' + esc(ph.link) + '" target="_blank" rel="noopener noreferrer" title="원본 출처에서 보기">'
          : '<figure class="ph">') +
        '<img src="' + esc(ph.src) + '" alt="' + esc(ph.alt) + '" loading="lazy" referrerpolicy="no-referrer">' +
        (ph.credit ? '<figcaption>' + esc(ph.credit) + '</figcaption>' : '') +
        (ph.link ? '</a>' : '</figure>')).join('') + '</div>';
      if (photos[0].link) html += '<p class="fineprint">네이버 이미지 검색 결과예요. 사진을 누르면 원본 출처로 이동해요.</p>';
    } else {
      html += '<p class="muted">저작권 때문에 아직 사진을 직접 올리지 않았어요. 아래에서 최신 사진을 볼 수 있어요.</p>';
    }
    html += '<div class="linkrow">' +
      '<a class="lbtn" href="' + esc(naverPlaceUrl(p, 'photo')) + '" target="_blank" rel="noopener">네이버 지도 사진' + ICON('external') + '</a>' +
      (tag ? '<a class="lbtn" href="' + esc(instaTagUrl(tag)) + '" target="_blank" rel="noopener">인스타 #' + esc(tag) + ICON('external') + '</a>' : '') +
      '<a class="lbtn" href="' + esc(naverImageSearchUrl(p)) + '" target="_blank" rel="noopener">네이버 이미지' + ICON('external') + '</a>' +
      '</div>';
    return html;
  }

  function sourceBlock(p) {
    const parts = [];
    if (p.operatingEvidence) parts.push('영업 확인: ' + esc(p.operatingEvidence));
    if (p.verifiedAt) parts.push('정보 정리: ' + esc(p.verifiedAt));
    if (p.coordsApprox) parts.push('지도 위치는 주소로 추정한 값이에요.');
    const feedback = CFG.FEEDBACK_URL
      ? '<a class="lbtn" href="' + esc(CFG.FEEDBACK_URL + encodeURIComponent(p.name)) + '" target="_blank" rel="noopener">정보 수정 제안' + ICON('external') + '</a>'
      : '';
    return '<footer class="sources"><p>' + parts.join('<br>') + '</p><p>요금과 운영 시간은 자주 바뀌어요. 방문 전에 한 번 더 확인해 주세요.</p>' + feedback + '</footer>';
  }

  function renderDetail(p) {
    const fav = state.favs.has(p.id);
    const mobile = isMobile();
    const badges = [
      p.gender === 'female' ? '<span class="badge badge-female">여성전용</span>' : '',
      p.confidence === 'low' ? '<span class="badge badge-warn">정보 확인 필요</span>' : '',
      p.coordsApprox ? '<span class="badge">추정 위치</span>' : ''
    ].join('');
    const second = p.phone
      ? '<a class="act" href="' + esc(telHref(p.phone)) + '">' + ICON('phone') + '<span>전화</span></a>'
      : '<button type="button" class="act" data-tab="review">' + ICON('list') + '<span>후기</span></button>';
    els.detail.innerHTML =
      '<div class="d-top">' +
        '<button type="button" class="icon-btn" data-close aria-label="' + (mobile ? '목록으로' : '상세 닫기') + '">' + ICON(mobile ? 'back' : 'close') + '</button>' +
        '<span class="d-top-name">' + esc(p.name) + '</span>' +
        '<button type="button" class="icon-btn" data-share="' + esc(p.id) + '" aria-label="링크 복사">' + ICON('share') + '</button>' +
      '</div>' +
      coverHtml(p) +
      '<div class="d-head">' +
        '<h2 class="d-name" id="dName" tabindex="-1">' + esc(p.name) + '</h2><span class="d-cat">' + esc(category(p)) + '</span>' +
        (p.nameEn ? '<p class="d-en">' + esc(p.nameEn) + '</p>' : '') +
        '<p class="d-status">' + statusLine(p, true) + '</p>' +
        headPrice(p) +
        (badges ? '<div class="d-badges">' + badges + '</div>' : '') +
        (p.alert ? '<p class="callout">' + esc(p.alert) + '</p>' : '') +
      '</div>' +
      '<div class="d-actions">' +
        '<a class="act act-primary" href="' + esc(naverPlaceUrl(p)) + '" target="_blank" rel="noopener">' + ICON('map') + '<span>네이버 지도</span></a>' +
        second +
        '<button type="button" class="act" data-fav="' + esc(p.id) + '" aria-pressed="' + fav + '">' + ICON('heart') + '<span>찜</span></button>' +
        '<button type="button" class="act" data-share="' + esc(p.id) + '">' + ICON('share') + '<span>공유</span></button>' +
      '</div>' +
      '<nav class="d-tabs" aria-label="상세 정보 바로가기">' +
        TABS.map((t, i) => '<button type="button" class="d-tab' + (i === 0 ? ' is-active' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') +
      '</nav>' +
      section('home', '', homeBlock(p)) +
      section('price', '요금', priceBlock(p)) +
      section('facility', '시설', facilitiesBlock(p)) +
      section('review', '리뷰', reviewBlock(p)) +
      section('photo', '사진', photoBlock(p)) +
      sourceBlock(p);
    processInstagram();
  }

  const section = (key, title, inner) =>
    '<section class="d-sec" id="sec-' + key + '" data-sec="' + key + '">' + (title ? '<h3>' + esc(title) + '</h3>' : '') + inner + '</section>';

  let instaLoaded = false;
  function processInstagram() {
    if (!els.detail.querySelector('.instagram-media')) return;
    if (window.instgrm && window.instgrm.Embeds) { window.instgrm.Embeds.process(); return; }
    if (instaLoaded) return;
    instaLoaded = true;
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.instagram.com/embed.js';
    document.body.appendChild(s);
  }

  // 상세는 데스크톱에서 목록 옆 패널, 휴대폰에서는 시트 안에 둡니다.
  function placeDetail() {
    if (isMobile()) {
      if (els.detail.parentNode !== els.body) els.body.appendChild(els.detail);
      els.detail.classList.add('in-sheet');
    } else {
      if (els.detail.parentNode !== els.app) els.app.insertBefore(els.detail, els.mapWrap);
      els.detail.classList.remove('in-sheet');
    }
  }

  const detailScroller = () => (isMobile() ? els.body : els.detail);

  function onDetailScroll() {
    if (!state.selectedId) return;
    const top = $('.d-top', els.detail);
    const head = $('.d-head', els.detail);
    const tabs = $('.d-tabs', els.detail);
    if (!top || !head || !tabs) return;
    top.classList.toggle('is-stuck', head.getBoundingClientRect().top < top.getBoundingClientRect().bottom - 8);
    const line = tabs.getBoundingClientRect().bottom + 40;
    let active = 'home';
    els.detail.querySelectorAll('[data-sec]').forEach((s) => { if (s.getBoundingClientRect().top <= line) active = s.dataset.sec; });
    const sc = detailScroller();
    if (sc.scrollTop > 0 && sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) active = TABS[TABS.length - 1][0];
    els.detail.querySelectorAll('.d-tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === active));
  }

  function scrollToSection(key) {
    const sec = $('#sec-' + key, els.detail);
    if (!sec) return;
    if (isMobile() && state.sheet !== 'full') setSheet('full');
    const sc = detailScroller();
    const top = $('.d-top', els.detail), tabs = $('.d-tabs', els.detail);
    const stick = (top ? top.offsetHeight : 0) + (tabs ? tabs.offsetHeight : 0);
    const y = sec.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - stick + 1;
    sc.scrollTo({ top: Math.max(0, y), behavior: reduceMotion() ? 'auto' : 'smooth' });
  }

  // ---------------------------------------------------------------- selection & routing
  function openDetail(id, opts) {
    const p = BY_ID[id];
    if (!p) return closeDetail();
    if (!state.selectedId) listScrollTop = els.body.scrollTop;
    state.selectedId = id;
    els.app.classList.add('has-detail');
    placeDetail();
    renderDetail(p);
    els.detail.hidden = false;
    detailScroller().scrollTop = 0;
    if (isMobile() && state.sheet === 'peek') state.sheet = 'half';
    applySheet();
    refresh();
    if (mapApi && !(opts && opts.noFocus)) {
      const o = mapOffsets();
      programmatic(() => mapApi.focus(p, o.x, o.y));
    }
    const h = $('#dName');
    if (h && !(opts && opts.noFocusHeading)) h.focus({ preventScroll: true });
    onDetailScroll();
  }

  function closeDetail() {
    if (!state.selectedId) return;
    const prev = state.selectedId;
    state.selectedId = null;
    els.app.classList.remove('has-detail');
    els.detail.hidden = true;
    els.detail.innerHTML = '';
    applySheet();
    refresh();
    els.body.scrollTop = listScrollTop;
    const card = els.list.querySelector('[data-id="' + CSS.escape(prev) + '"]');
    if (card && !isMobile()) card.focus({ preventScroll: true });
  }

  const currentHash = () => decodeURIComponent(location.hash.replace(/^#/, ''));

  function route() {
    const id = currentHash();
    if (id && BY_ID[id]) openDetail(id);
    else closeDetail();
  }

  function refresh(opts) {
    const list = filtered();
    renderList(list);
    if (mapApi) {
      mapApi.update(list.map((p) => p.id), state.selectedId);
      if (opts && opts.fit && list.length) programmatic(() => mapApi.fit(list, fitPadding()));
      scheduleDeclutter();
    }
  }

  // 핀끼리 겹치면 우선순위(추천순)가 낮은 쪽을 작은 점으로 바꿉니다. 확대하면 다시 펼쳐져요.
  let declutterTimer = 0;
  function scheduleDeclutter() {
    clearTimeout(declutterTimer);
    declutterTimer = setTimeout(declutter, 90);
  }
  function declutter() {
    if (!mapApi || !mapApi.toPixel || !mapApi.setCompact) return;
    const order = filtered().sort((a, b) => (b.id === state.selectedId) - (a.id === state.selectedId) || a.index - b.index);
    const boxes = [];
    const compact = new Set();
    order.forEach((p) => {
      const pt = mapApi.toPixel(p.lat, p.lng);
      if (!pt) return;
      const w = p.id === state.selectedId ? 104 : (p.minPrice ? 68 : 86) + (p.gender === 'female' ? 26 : 0);
      const r = { x1: pt.x - w / 2, x2: pt.x + w / 2, y1: pt.y - 42, y2: pt.y - 6 };
      const hit = boxes.some((b) => r.x1 < b.x2 && r.x2 > b.x1 && r.y1 < b.y2 && r.y2 > b.y1);
      if (hit && p.id !== state.selectedId) compact.add(p.id);
      else boxes.push(r);
    });
    mapApi.setCompact(compact);
  }

  // ---------------------------------------------------------------- 지도 여백 계산
  function mapOffsets() {
    if (!isMobile()) return { x: state.selectedId ? Math.round((els.detail.offsetWidth || 390) / 2) : 0, y: 0 };
    const mapH = window.innerHeight - peekPx();
    const top = state.selectedId ? 0 : els.head.offsetHeight;
    const covered = Math.max(0, sheetVisiblePx() - peekPx());
    return { x: 0, y: Math.round(mapH / 2 - (top + mapH - covered) / 2) };
  }

  function fitPadding() {
    if (isMobile()) {
      return { top: (state.selectedId ? 0 : els.head.offsetHeight) + 20, right: 56, bottom: Math.max(0, sheetVisiblePx() - peekPx()) + 24, left: 24 };
    }
    return { top: 70, right: 70, bottom: 50, left: (state.selectedId ? els.detail.offsetWidth || 390 : 0) + 60 };
  }

  // ---------------------------------------------------------------- 휴대폰 바텀시트
  const sheetTopPx = () => (state.selectedId ? 10 : els.head.offsetHeight + 2);
  const peekPx = () => (state.selectedId ? els.grip.offsetHeight + 52 + 74 : els.sheetTop.offsetHeight + 98);

  function sheetVisiblePx() {
    if (state.sheet === 'full') return els.panel.offsetHeight;
    if (state.sheet === 'half') return Math.max(peekPx(), Math.round(window.innerHeight * 0.5));
    return peekPx();
  }

  function applySheet(dragY) {
    if (!isMobile()) {
      els.panel.style.transform = '';
      els.app.style.removeProperty('--map-bottom');
      els.app.style.removeProperty('--sheet-top');
      return;
    }
    els.app.style.setProperty('--sheet-top', sheetTopPx() + 'px');
    const H = els.panel.offsetHeight;
    const y = dragY != null ? dragY : Math.max(0, H - sheetVisiblePx());
    els.panel.style.transform = 'translateY(' + y + 'px)';
    els.app.style.setProperty('--map-bottom', peekPx() + 'px');
  }

  function setSheet(name) {
    state.sheet = name;
    applySheet();
  }

  function bindSheet() {
    let startY = 0, startT = 0, dragging = false, moved = 0, pid = null;
    const currentY = () => {
      const m = /translateY\(([-\d.]+)px\)/.exec(els.panel.style.transform || '');
      return m ? parseFloat(m[1]) : 0;
    };
    els.panel.addEventListener('pointerdown', (e) => {
      if (!isMobile() || !e.target.closest('.sheet-top, .d-top')) return;
      if (e.target.closest('button, select, a, input, label')) return;
      dragging = true; moved = 0; pid = e.pointerId;
      startY = e.clientY; startT = currentY();
      els.panel.setPointerCapture(e.pointerId);
      els.panel.classList.add('is-dragging');
    });
    els.panel.addEventListener('pointermove', (e) => {
      if (!dragging || e.pointerId !== pid) return;
      const dy = e.clientY - startY;
      moved = Math.max(moved, Math.abs(dy));
      applySheet(Math.min(els.panel.offsetHeight - peekPx(), Math.max(0, startT + dy)));
    });
    const end = (e) => {
      if (!dragging || e.pointerId !== pid) return;
      dragging = false;
      els.panel.classList.remove('is-dragging');
      const dy = e.clientY - startY;
      const order = ['peek', 'half', 'full'];
      let i = order.indexOf(state.sheet);
      if (moved < 6) i = state.sheet === 'peek' ? 1 : state.sheet === 'half' ? 2 : 1;
      else if (dy < -40) i = Math.min(2, i + (dy < -220 ? 2 : 1));
      else if (dy > 40) i = Math.max(0, i - (dy > 220 ? 2 : 1));
      setSheet(order[i]);
    };
    els.panel.addEventListener('pointerup', end);
    els.panel.addEventListener('pointercancel', end);
    els.q.addEventListener('focus', () => { if (isMobile() && !state.selectedId && state.sheet !== 'full') setSheet('full'); });
    els.body.addEventListener('scroll', () => {
      if (!isMobile()) return;
      if (state.sheet === 'half' && els.body.scrollTop > 24) setSheet('full');
      onDetailScroll();
    }, { passive: true });
    els.detail.addEventListener('scroll', onDetailScroll, { passive: true });
    window.addEventListener('resize', () => applySheet());
  }

  // ---------------------------------------------------------------- misc
  let toastTimer = 0;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 2200);
  }

  function copyText(text, okMsg) {
    const done = () => toast(okMsg || '복사했어요');
    const fail = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) done(); else toast(text);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fail);
    else fail();
  }

  function locate(opts) {
    if (!navigator.geolocation) { toast('이 브라우저에서는 위치를 쓸 수 없어요'); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      state.userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      els.mcLocate.classList.add('is-on');
      if (mapApi) {
        mapApi.setUserPosition(state.userPos);
        if (opts && opts.pan) {
          const o = mapOffsets();
          programmatic(() => mapApi.panToLatLng(state.userPos.lat, state.userPos.lng, o.x, o.y));
        }
      }
      refresh();
    }, () => {
      toast('위치 권한이 없어 현재 위치를 쓸 수 없어요');
      if (state.sort === 'near') { state.sort = 'rec'; els.sort.value = 'rec'; refresh(); }
    }, { timeout: 8000, maximumAge: 60000 });
  }

  function bindGlobal() {
    document.addEventListener('click', (e) => {
      const fav = e.target.closest('[data-fav]');
      if (fav) { e.preventDefault(); toggleFav(fav.dataset.fav); return; }
      const cp = e.target.closest('[data-copy]');
      if (cp) { copyText(cp.dataset.copy); return; }
      const sh = e.target.closest('[data-share]');
      if (sh) { copyText(location.href.split('#')[0] + '#' + sh.dataset.share, '링크를 복사했어요'); return; }
      const tab = e.target.closest('[data-tab]');
      if (tab) { scrollToSection(tab.dataset.tab); return; }
      if (e.target.closest('[data-close]')) { location.hash = ''; return; }
      const card = e.target.closest('a.card');
      if (card && card.dataset.id === state.selectedId) { e.preventDefault(); openDetail(card.dataset.id); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.selectedId) location.hash = '';
    });
    $('.rail-logo').addEventListener('click', (e) => {
      e.preventDefault();
      if (state.selectedId) location.hash = '';
      resetFilters();
    });
    els.railList.addEventListener('click', () => {
      if (state.selectedId) location.hash = '';
      els.q.focus();
    });
    els.railFav.addEventListener('click', () => toggleChip('fav'));
  }

  function bindMapControls() {
    els.mcZoomIn.addEventListener('click', () => { if (mapApi) mapApi.zoomBy(1); els.areaSearch.hidden = false; });
    els.mcZoomOut.addEventListener('click', () => { if (mapApi) mapApi.zoomBy(-1); els.areaSearch.hidden = false; });
    els.mcFit.addEventListener('click', () => {
      const list = filtered();
      if (mapApi) programmatic(() => mapApi.fit(list.length ? list : PLACES, fitPadding()));
    });
    els.mcLocate.addEventListener('click', () => locate({ pan: true }));
    els.areaSearch.addEventListener('click', () => {
      if (!mapApi) return;
      state.bounds = mapApi.getBounds();
      els.areaSearch.hidden = true;
      renderChips();
      refresh();
      if (isMobile() && !state.selectedId && state.sheet === 'peek') setSheet('half');
    });
  }

  // ---------------------------------------------------------------- map
  function pinHtml(p, selected, compact) {
    const fav = state.favs.has(p.id);
    const price = p.minPrice ? shortWon(p.minPrice) : '요금 확인';
    const label = p.name + ', ' + (p.minPrice ? won(p.minPrice) + '부터' : '요금 확인 중');
    if (compact && !selected) {
      return '<button type="button" class="pin is-compact' + (p.gender === 'female' ? ' is-female' : '') + '" aria-label="' + esc(label) + '" title="' + esc(p.name + ' · ' + price) + '">' +
        '<span class="pin-dot" aria-hidden="true">' + (fav ? '♥' : '♨') + '</span></button>';
    }
    const cls = 'pin' + (selected ? ' is-selected' : '') + (p.gender === 'female' ? ' is-female' : '');
    return '<button type="button" class="' + cls + '" aria-label="' + esc(label) + '" title="' + esc(p.name) + '">' +
      '<span class="pin-dot" aria-hidden="true">' + (fav ? '♥' : '♨') + '</span>' +
      (p.gender === 'female' ? '<span class="pin-tag">여성</span>' : '') +
      '<span class="pin-price">' + esc(price) + '</span></button>' +
      '<span class="pin-label" aria-hidden="true">' + esc(p.name) + '</span>';
  }

  const mapHandlers = {
    onMarkerClick(id) {
      lastMarkerClick = Date.now();
      if (currentHash() === id) openDetail(id);
      else location.hash = id;
    },
    onMapClick() {
      if (Date.now() - lastMarkerClick < 300 || !isMobile()) return;
      if (state.selectedId) location.hash = '';
      else if (state.sheet !== 'peek') setSheet('peek');
    },
    onViewChange() {
      if (Date.now() < suppressViewUntil) return;
      els.areaSearch.hidden = false;
    },
    onZoomChange() { scheduleDeclutter(); }
  };

  function startMap(reason) {
    if (mapApi) mapApi.destroy();
    els.map.innerHTML = '';
    mapApi = new window.FallbackMap(els.map, mapHandlers);
    mapApi.setPlaces(PLACES, pinHtml);
    if (state.userPos) mapApi.setUserPosition(state.userPos);
    showNotice(reason);
  }

  function showNotice(reason) {
    const msgs = {
      preview: '미리보기용 간이 지도예요. 실제 서비스는 네이버 지도를 써요.',
      nokey: '간이 지도예요. config.js에 네이버 지도 키를 넣으면 바뀌어요.',
      auth: '네이버 지도 인증에 실패했어요. NCP 콘솔의 Key ID와 웹 서비스 URL을 확인해 주세요.',
      load: '네이버 지도를 불러오지 못해 간이 지도로 보여요.'
    };
    if (!reason) { els.notice.hidden = true; return; }
    els.notice.innerHTML = '<span>' + esc(msgs[reason] || msgs.load) + '</span><button type="button" class="mini" aria-label="안내 닫기">닫기</button>';
    els.notice.hidden = false;
    els.notice.querySelector('button').addEventListener('click', () => { els.notice.hidden = true; });
    // 휴대폰에서는 지도를 가리지 않도록 잠깐 보여주고 숨깁니다.
    if (isMobile() && reason !== 'auth') setTimeout(() => { els.notice.hidden = true; }, 6000);
  }

  function initMap() {
    const key = CFG.NAVER_MAP_KEY_ID;
    if (CFG.PREVIEW) return Promise.resolve(startMap('preview'));
    if (!key) return Promise.resolve(startMap('nokey'));
    window.navermap_authFailure = function () {
      startMap('auth');
      refresh();
    };
    return window.NaverMapAdapter.load(key).then(() => {
      els.map.innerHTML = '';
      mapApi = new window.NaverMapAdapter.Map(els.map, Object.assign({ center: CFG.START_CENTER, zoom: CFG.START_ZOOM }, mapHandlers));
      mapApi.setPlaces(PLACES, pinHtml);
      showNotice(null);
    }).catch(() => startMap('load'));
  }

  // ---------------------------------------------------------------- boot
  function fillIcons() {
    document.querySelectorAll('[data-icon]').forEach((n) => { n.outerHTML = ICON(n.dataset.icon, n.className); });
  }

  function boot() {
    fillIcons();
    renderChips();
    bindFilters();
    bindGlobal();
    bindSheet();
    bindMapControls();
    placeDetail();
    renderList(filtered());
    applySheet();
    initMap().then(() => {
      if (window.ResizeObserver) new ResizeObserver(() => mapApi && mapApi.resize()).observe(els.map);
      refresh();
      const id = currentHash();
      if (id && BY_ID[id]) openDetail(id, { noFocusHeading: true });
      else if (mapApi) programmatic(() => mapApi.fit(PLACES, fitPadding()));
    });
    window.addEventListener('hashchange', route);
    const onBreakpoint = () => {
      placeDetail();
      if (state.selectedId) renderDetail(BY_ID[state.selectedId]);
      applySheet();
    };
    if (mq.addEventListener) mq.addEventListener('change', onBreakpoint); else mq.addListener(onBreakpoint);
    setInterval(() => { NOW = kstNow(); refresh(); }, 60000);
  }

  boot();
})();
