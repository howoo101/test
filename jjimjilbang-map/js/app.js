/*
 * 서울 찜질방 지도 - 앱 로직
 * 데이터: window.JJIM_DATA (data/places.js), window.JJIM_NAVER (data/naver-content.js)
 * 지도: 네이버 지도(map-naver.js) 또는 간이 지도(map-fallback.js)
 */
(function () {
  'use strict';

  const CFG = window.JJIM_CONFIG || {};
  const FAC = window.JJIM_FACILITIES;
  const DATA = window.JJIM_DATA || { places: [] };
  const NAVER = window.JJIM_NAVER || { byPlace: {} };
  const CHILD_RE = /소인|어린이|아동|청소년|유아|초등|미취학/;
  const ADULT_WHO = ['대인', '성인', '공통'];

  // ---------------------------------------------------------------- utils
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const won = (n) => n.toLocaleString('ko-KR') + '원';
  const num = (n) => n.toLocaleString('ko-KR');
  const normText = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');
  const isMobile = () => window.matchMedia('(max-width: 859px)').matches;

  function shortWon(n) {
    if (n % 1000 !== 0) return num(n);
    if (n < 10000) return n / 1000 + '천';
    return Math.round(n / 1000) / 10 + '만';
  }

  function safeUrl(u) {
    return /^https?:\/\//i.test(String(u || '')) ? u : '#';
  }

  function distanceKm(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 저장 불가 환경 */ }
    }
  };

  // ---------------------------------------------------------------- data
  // who 값이 있으면 그것으로, 없으면 라벨 글자로 어른 요금인지 판단합니다.
  function isAdult(r) { return r.who ? ADULT_WHO.indexOf(r.who) >= 0 : !CHILD_RE.test(r.label || ''); }

  function normalize(p, index) {
    const prices = (p.prices || []).filter((r) => typeof r.price === 'number' && r.price > 0);
    const jjim = prices.filter((r) => (r.type || '찜질') === '찜질' && isAdult(r));
    const adult = prices.filter(isAdult);
    const base = jjim.length ? jjim : adult;
    return Object.assign({}, p, {
      index,
      prices,
      facilities: p.facilities || [],
      hashtags: p.hashtags || [],
      priceRows: base,
      minPrice: base.length ? Math.min.apply(null, base.map((r) => r.price)) : null,
      haystack: normText([p.name, p.nameEn, (p.aliases || []).join(' '), p.gu, p.address, p.station, (p.hashtags || []).join(' ')].join(' '))
    });
  }

  const PLACES = (DATA.places || []).map(normalize);
  const BY_ID = {};
  PLACES.forEach((p) => { BY_ID[p.id] = p; });

  function naverInfo(p) { return (NAVER.byPlace && NAVER.byPlace[p.id]) || null; }

  function naverPlaceUrl(p, tab) {
    if (p.naverPlaceId) {
      return 'https://m.place.naver.com/place/' + encodeURIComponent(p.naverPlaceId) + '/' + (tab || 'home');
    }
    return 'https://map.naver.com/p/search/' + encodeURIComponent(p.naverQuery || p.name);
  }
  const naverBlogSearchUrl = (p) => 'https://search.naver.com/search.naver?where=blog&query=' + encodeURIComponent((p.naverQuery || p.name) + ' 후기');
  const naverImageSearchUrl = (p) => 'https://search.naver.com/search.naver?where=image&query=' + encodeURIComponent(p.naverQuery || p.name);
  const instaTagUrl = (tag) => 'https://www.instagram.com/explore/tags/' + encodeURIComponent(String(tag).replace(/^#/, '')) + '/';

  // ---------------------------------------------------------------- state
  const state = {
    q: '',
    chips: new Set(),
    gu: '',
    maxPrice: 0,
    sort: 'rec',
    selectedId: null,
    favs: new Set(store.get('jjim:favs', [])),
    userPos: null,
    sheet: 'peek'
  };
  let mapApi = null;
  let lastMarkerClick = 0;
  let listScrollTop = 0;

  // ---------------------------------------------------------------- dom
  const els = {
    app: $('#app'),
    panel: $('#panel'),
    grip: $('#sheetGrip'),
    head: $('#panelHead'),
    body: $('#panelBody'),
    q: $('#q'),
    chips: $('#chips'),
    gu: $('#fGu'),
    price: $('#fPrice'),
    sort: $('#fSort'),
    count: $('#count'),
    reset: $('#reset'),
    list: $('#list'),
    empty: $('#empty'),
    detail: $('#detail'),
    map: $('#map'),
    notice: $('#mapNotice'),
    toast: $('#toast')
  };

  // ---------------------------------------------------------------- filters UI
  const SPECIAL_CHIPS = [
    { id: 'fav', label: '♥ 찜한 곳' },
    { id: 'open24h', label: '24시간' },
    { id: 'female', label: '여성전용' }
  ];

  function buildFilters() {
    const chips = SPECIAL_CHIPS.concat(FAC.quickFilters.map((k) => ({ id: k, label: FAC.items[k].short })));
    els.chips.innerHTML = chips.map((c) =>
      '<button type="button" class="chip" data-chip="' + c.id + '" aria-pressed="false">' + esc(c.label) + '</button>'
    ).join('');
    els.chips.addEventListener('click', (e) => {
      const b = e.target.closest('[data-chip]');
      if (!b) return;
      const id = b.dataset.chip;
      if (state.chips.has(id)) state.chips.delete(id); else state.chips.add(id);
      b.setAttribute('aria-pressed', String(state.chips.has(id)));
      refresh();
    });

    const guCounts = {};
    PLACES.forEach((p) => { guCounts[p.gu] = (guCounts[p.gu] || 0) + 1; });
    els.gu.innerHTML = '<option value="">전체 지역</option>' + Object.keys(guCounts).sort((a, b) => a.localeCompare(b, 'ko'))
      .map((g) => '<option value="' + esc(g) + '">' + esc(g) + ' (' + guCounts[g] + ')</option>').join('');
    els.gu.addEventListener('change', () => { state.gu = els.gu.value; refresh({ fit: true }); });

    els.price.addEventListener('change', () => { state.maxPrice = Number(els.price.value) || 0; refresh(); });

    const hasReviewCounts = PLACES.some((p) => naverInfo(p) && naverInfo(p).blogTotal);
    if (hasReviewCounts) {
      const opt = document.createElement('option');
      opt.value = 'reviews';
      opt.textContent = '후기 많은순';
      els.sort.appendChild(opt);
    }
    els.sort.addEventListener('change', () => {
      state.sort = els.sort.value;
      if (state.sort === 'near' && !state.userPos) locate();
      refresh();
    });

    let t = 0;
    els.q.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = els.q.value.trim(); refresh({ fit: !!state.q }); }, 160);
    });
    els.q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = filtered()[0];
        if (first) location.hash = first.id;
      }
    });

    els.reset.addEventListener('click', () => {
      state.q = ''; els.q.value = '';
      state.chips.clear();
      els.chips.querySelectorAll('[aria-pressed]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      state.gu = ''; els.gu.value = '';
      state.maxPrice = 0; els.price.value = '';
      refresh({ fit: true });
    });
  }

  function filtersActive() {
    return !!(state.q || state.chips.size || state.gu || state.maxPrice);
  }

  function matches(p) {
    if (state.q && !p.haystack.includes(normText(state.q))) return false;
    if (state.gu && p.gu !== state.gu) return false;
    if (state.maxPrice && !(p.minPrice && p.minPrice <= state.maxPrice)) return false;
    for (const c of state.chips) {
      if (c === 'fav') { if (!state.favs.has(p.id)) return false; }
      else if (c === 'open24h') { if (!p.open24h) return false; }
      else if (c === 'female') { if (p.gender !== 'female') return false; }
      else if (!p.facilities.includes(c)) return false;
    }
    return true;
  }

  function filtered() {
    const list = PLACES.filter(matches);
    const byIndex = (a, b) => a.index - b.index;
    if (state.sort === 'price') {
      list.sort((a, b) => (a.minPrice || Infinity) - (b.minPrice || Infinity) || byIndex(a, b));
    } else if (state.sort === 'near' && state.userPos) {
      list.sort((a, b) => distanceKm(state.userPos, a) - distanceKm(state.userPos, b));
    } else if (state.sort === 'reviews') {
      const total = (p) => (naverInfo(p) && naverInfo(p).blogTotal) || 0;
      list.sort((a, b) => total(b) - total(a) || byIndex(a, b));
    } else {
      list.sort(byIndex);
    }
    return list;
  }

  // ---------------------------------------------------------------- list
  function tagList(p, limit) {
    const tags = [];
    if (p.alert) tags.push('<li class="tag tag-warn">' + esc(p.alert) + '</li>');
    if (p.confidence === 'low') tags.push('<li class="tag tag-warn">정보 확인 필요</li>');
    if (p.open24h) tags.push('<li class="tag tag-strong">24시간</li>');
    if (p.gender === 'female') tags.push('<li class="tag tag-female">여성전용</li>');
    const fac = p.facilities.filter((k) => FAC.items[k] && FAC.items[k].group !== 'amenity' || k === 'parking');
    fac.slice(0, limit).forEach((k) => tags.push('<li class="tag">' + esc(FAC.items[k].short) + '</li>'));
    const rest = p.facilities.length - Math.min(fac.length, limit);
    if (rest > 0) tags.push('<li class="tag tag-more">+' + rest + '</li>');
    return '<ul class="card-tags" aria-label="주요 시설">' + tags.join('') + '</ul>';
  }

  function priceLine(p) {
    if (!p.priceRows.length) return '<p class="card-prices is-missing">가격 정보 확인 중</p>';
    const rows = p.priceRows.slice(0, 3).map((r) =>
      '<span class="cp"><span class="cp-label">' + esc(r.label + (r.days && r.days !== '전체' ? ' ' + r.days.replace('주말·공휴일', '주말') : '')) + '</span> <b>' + num(r.price) + '</b></span>'
    );
    const more = p.priceRows.length > 3 ? '<span class="cp cp-more">외 ' + (p.priceRows.length - 3) + '개</span>' : '';
    return '<p class="card-prices">' + rows.join('<span class="sep" aria-hidden="true">·</span>') + more + '</p>';
  }

  function renderList(list) {
    els.count.textContent = list.length === PLACES.length ? '찜질방 ' + list.length + '곳' : list.length + '곳 / 전체 ' + PLACES.length;
    els.reset.hidden = !filtersActive();
    els.empty.hidden = list.length > 0 || !!state.selectedId;
    els.list.innerHTML = list.map((p) => {
      const fav = state.favs.has(p.id);
      const dist = state.userPos ? ' · ' + distanceKm(state.userPos, p).toFixed(1) + 'km' : '';
      return '<li class="item' + (p.id === state.selectedId ? ' is-active' : '') + '">' +
        '<a class="card" href="#' + esc(p.id) + '" data-id="' + esc(p.id) + '">' +
          '<span class="card-name">' + esc(p.name) + '</span>' +
          '<span class="card-meta">' + esc(p.gu) + (p.station ? ' · ' + esc(p.station) : '') + dist + '</span>' +
          priceLine(p) +
          tagList(p, 4) +
        '</a>' +
        favButton(p.id, fav, 'card-fav') +
      '</li>';
    }).join('');
  }

  function favButton(id, on, cls) {
    return '<button type="button" class="fav ' + cls + '" data-fav="' + esc(id) + '" aria-pressed="' + on + '" aria-label="찜하기" title="찜하기">' +
      '<span aria-hidden="true">' + (on ? '♥' : '♡') + '</span></button>';
  }

  function toggleFav(id) {
    if (state.favs.has(id)) state.favs.delete(id); else state.favs.add(id);
    store.set('jjim:favs', Array.from(state.favs));
    if (mapApi) mapApi.refreshPin(id);
    const on = state.favs.has(id);
    document.querySelectorAll('[data-fav="' + CSS.escape(id) + '"]').forEach((b) => {
      b.setAttribute('aria-pressed', String(on));
      b.firstElementChild.textContent = on ? '♥' : '♡';
    });
    toast(on ? '찜 목록에 담았어요' : '찜 목록에서 뺐어요');
    refresh();
  }

  // ---------------------------------------------------------------- detail
  function badge(text, cls) { return '<span class="badge ' + (cls || '') + '">' + esc(text) + '</span>'; }

  function priceTable(p) {
    if (!p.prices.length) {
      return '<p class="muted">아직 확인된 요금이 없어요. 방문 전 전화로 확인해 주세요.</p>';
    }
    const groups = {};
    p.prices.forEach((r) => { const t = r.type || '찜질'; (groups[t] = groups[t] || []).push(r); });
    const order = ['찜질', '목욕', '기타'].filter((t) => groups[t]).concat(Object.keys(groups).filter((t) => ['찜질', '목욕', '기타'].indexOf(t) < 0));
    const titles = { '찜질': '찜질 이용 (찜질+목욕)', '목욕': '목욕·사우나만', '기타': '기타 요금' };
    return order.map((t) =>
      '<div class="ptable-wrap"><table class="ptable"><caption>' + esc(titles[t] || t) + '</caption>' +
      '<thead><tr><th scope="col">구분</th><th scope="col">요일·시간</th><th scope="col" class="num">요금</th></tr></thead><tbody>' +
      groups[t].map((r) =>
        '<tr><th scope="row">' + esc(r.label) + (r.who && r.who !== '공통' ? ' <span class="who">' + esc(r.who) + '</span>' : '') + '</th>' +
        '<td>' + esc([r.days && r.days !== '전체' ? r.days : '', r.time || ''].filter(Boolean).join(' ') || '전체') +
          (r.note ? '<span class="pnote">' + esc(r.note) + '</span>' : '') + '</td>' +
        '<td class="num">' + won(r.price) + '</td></tr>'
      ).join('') + '</tbody></table></div>'
    ).join('');
  }

  function facilitiesBlock(p) {
    if (!p.facilities.length) return '<p class="muted">시설 정보 확인 중이에요.</p>';
    return FAC.groups.map((g) => {
      const items = p.facilities.filter((k) => FAC.items[k] && FAC.items[k].group === g.id);
      if (!items.length) return '';
      return '<div class="fgroup"><h4 class="fgroup-title">' + esc(g.label) + '</h4><ul class="fgrid">' +
        items.map((k) => '<li class="fitem"><span class="ficon" aria-hidden="true">' + FAC.items[k].icon + '</span>' + esc(FAC.items[k].label) + '</li>').join('') +
        '</ul></div>';
    }).join('');
  }

  function photosBlock(p) {
    const nv = naverInfo(p);
    let gallery = '';
    if (p.photos && p.photos.length) {
      gallery = '<div class="gallery">' + p.photos.map((ph) =>
        '<figure class="ph"><img src="' + esc(safeUrl(ph.url)) + '" alt="' + esc(p.name + ' ' + (ph.caption || '사진')) + '" loading="lazy">' +
        (ph.credit ? '<figcaption>' + esc(ph.credit) + '</figcaption>' : '') + '</figure>').join('') + '</div>';
    } else if (nv && nv.images && nv.images.length) {
      gallery = '<div class="gallery">' + nv.images.slice(0, 10).map((im) =>
        '<a class="ph" href="' + esc(safeUrl(im.link)) + '" target="_blank" rel="noopener noreferrer" title="원본 출처에서 보기">' +
        '<img src="' + esc(safeUrl(im.thumbnail)) + '" alt="' + esc(im.title || p.name) + '" loading="lazy" referrerpolicy="no-referrer"></a>').join('') +
        '</div><p class="fineprint">네이버 이미지 검색 결과예요. 사진을 누르면 원본 출처로 이동해요.</p>';
    } else {
      gallery = '<div class="ph-empty"><span class="ph-mark" aria-hidden="true">♨</span>' +
        '<p><b>아직 등록된 사진이 없어요.</b><br>아래 버튼으로 최신 사진을 바로 볼 수 있어요.</p></div>';
    }
    const tag = p.hashtags[0];
    return gallery +
      '<div class="linkrow">' +
        '<a class="lbtn" href="' + esc(naverPlaceUrl(p, 'photo')) + '" target="_blank" rel="noopener">네이버 지도 사진</a>' +
        (tag ? '<a class="lbtn" href="' + esc(instaTagUrl(tag)) + '" target="_blank" rel="noopener">인스타 #' + esc(tag) + '</a>' : '') +
        '<a class="lbtn" href="' + esc(naverImageSearchUrl(p)) + '" target="_blank" rel="noopener">네이버 이미지</a>' +
      '</div>';
  }

  function reviewSummary(p) {
    const good = p.highlights || [];
    const bad = p.cons || [];
    if (!good.length && !bad.length) return '';
    return '<div class="sumgrid">' +
      (good.length ? '<div class="sum sum-good"><h4>좋았다는 점</h4><ul>' + good.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul></div>' : '') +
      (bad.length ? '<div class="sum sum-bad"><h4>아쉽다는 점</h4><ul>' + bad.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul></div>' : '') +
      '</div><p class="fineprint">블로그·기사 후기를 모아 요약했어요. 원문은 아래 링크에서 확인하세요.</p>';
  }

  function blogBlock(p) {
    const nv = naverInfo(p);
    let items = [];
    let fromApi = false;
    if (nv && nv.blog && nv.blog.length) {
      fromApi = true;
      items = nv.blog.slice(0, 6).map((b) => ({ title: b.title, url: b.link, source: b.bloggername, date: b.postdate, text: b.description }));
    } else {
      items = (p.reviewLinks || []).map((r) => ({ title: r.title, url: r.url, source: r.source, date: r.date }));
    }
    const head = fromApi && nv.blogTotal ? '<p class="muted">네이버 블로그 후기 ' + num(nv.blogTotal) + '건 중 관련도 높은 글</p>' : '';
    const list = items.length ? '<ul class="rlist">' + items.map((r) =>
      '<li><a href="' + esc(safeUrl(r.url)) + '" target="_blank" rel="noopener noreferrer">' +
      '<span class="rtitle">' + esc(r.title) + '</span>' +
      (r.text ? '<span class="rtext">' + esc(r.text) + '</span>' : '') +
      '<span class="rmeta">' + esc([r.source, r.date].filter(Boolean).join(' · ')) + '</span></a></li>').join('') + '</ul>'
      : '<p class="muted">모아 둔 후기가 아직 없어요.</p>';
    return head + list +
      '<div class="linkrow">' +
        '<a class="lbtn" href="' + esc(naverBlogSearchUrl(p)) + '" target="_blank" rel="noopener">네이버 블로그 후기 더 보기</a>' +
        '<a class="lbtn" href="' + esc(naverPlaceUrl(p, 'review/visitor')) + '" target="_blank" rel="noopener">네이버 방문자 리뷰</a>' +
      '</div>';
  }

  function instaBlock(p) {
    const tags = p.hashtags;
    const posts = p.instagramPosts || [];
    let html = '';
    if (posts.length) {
      html += '<div class="insta-posts">' + posts.map((u) =>
        '<blockquote class="instagram-media" data-instgrm-permalink="' + esc(safeUrl(u)) + '" data-instgrm-version="14">' +
        '<a href="' + esc(safeUrl(u)) + '" target="_blank" rel="noopener">인스타그램 게시물 보기</a></blockquote>').join('') + '</div>';
    }
    html += tags.length
      ? '<div class="linkrow">' + tags.map((t) => '<a class="lbtn lbtn-tag" href="' + esc(instaTagUrl(t)) + '" target="_blank" rel="noopener">#' + esc(t) + '</a>').join('') + '</div>'
      : '<p class="muted">등록된 해시태그가 없어요.</p>';
    return html;
  }

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

  function infoBlock(p) {
    const rows = [];
    if (p.address) rows.push(['주소', esc(p.address) + ' <button type="button" class="mini" data-copy="' + esc(p.address) + '">복사</button>']);
    if (p.station) rows.push(['교통', esc(p.station)]);
    rows.push(['운영', esc(p.hours || (p.open24h ? '24시간' : '확인 필요'))]);
    if (p.phone) rows.push(['전화', '<a href="tel:' + esc(p.phone.replace(/[^0-9+]/g, '')) + '">' + esc(p.phone) + '</a> <button type="button" class="mini" data-copy="' + esc(p.phone) + '">복사</button>']);
    rows.push(['이용', p.gender === 'female' ? '여성 전용' : p.gender === 'male' ? '남성 전용' : '남녀 모두 (탕은 분리)']);
    return '<dl class="info">' + rows.map((r) => '<div class="info-row"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>').join('') + '</dl>';
  }

  function sourceBlock(p) {
    const parts = [];
    if (p.priceSource && p.priceSource.url) {
      parts.push('가격 출처: <a href="' + esc(safeUrl(p.priceSource.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(p.priceSource.label || '원문 보기') + '</a>' + (p.priceSource.date ? ' (' + esc(p.priceSource.date) + ' 기준)' : ''));
    }
    if (p.operatingEvidence) parts.push('영업 확인: ' + esc(p.operatingEvidence));
    if (p.verifiedAt) parts.push('정보 정리: ' + esc(p.verifiedAt));
    if (p.coordsApprox) parts.push('지도 위치는 주소 기준 추정값이에요.');
    const feedback = CFG.FEEDBACK_URL ? '<a class="lbtn" href="' + esc(CFG.FEEDBACK_URL + encodeURIComponent(p.name)) + '" target="_blank" rel="noopener">정보가 달라요</a>' : '';
    return '<div class="sources"><p>' + parts.join('<br>') + '</p><p>요금과 운영 시간은 자주 바뀌어요. 방문 전에 한 번 더 확인해 주세요.</p>' + feedback + '</div>';
  }

  function renderDetail(p) {
    const fav = state.favs.has(p.id);
    const badges = [
      p.open24h ? badge('24시간', 'badge-strong') : '',
      p.gender === 'female' ? badge('여성전용', 'badge-female') : '',
      p.confidence === 'low' ? badge('정보 확인 필요', 'badge-warn') : '',
      p.minPrice ? badge(won(p.minPrice) + '부터', 'badge-price') : ''
    ].join('');
    const callout = p.alert ? '<p class="callout">' + esc(p.alert) + '</p>' : '';
    els.detail.innerHTML =
      '<div class="dhead">' +
        '<a class="back" href="#" aria-label="목록으로">← 목록</a>' +
        favButton(p.id, fav, 'detail-fav') +
      '</div>' +
      '<header class="dtitle">' +
        '<h2 id="dName" tabindex="-1">' + esc(p.name) + '</h2>' +
        (p.nameEn ? '<p class="dname-en">' + esc(p.nameEn) + '</p>' : '') +
        '<p class="dmeta">' + esc(p.gu) + (p.station ? ' · ' + esc(p.station) : '') + '</p>' +
        '<div class="badges">' + badges + '</div>' + callout +
        '<div class="actions">' +
          '<a class="abtn abtn-primary" href="' + esc(naverPlaceUrl(p)) + '" target="_blank" rel="noopener">네이버 지도에서 열기</a>' +
          (p.phone ? '<a class="abtn" href="tel:' + esc(p.phone.replace(/[^0-9+]/g, '')) + '">전화</a>' : '') +
          '<button type="button" class="abtn" data-share="' + esc(p.id) + '">링크 복사</button>' +
        '</div>' +
      '</header>' +
      section('사진', photosBlock(p)) +
      section('요금', priceTable(p) + extrasBlock(p) + (p.priceNote ? '<p class="fineprint">' + esc(p.priceNote) + '</p>' : '')) +
      section('시설', facilitiesBlock(p) + (p.facilityNotes ? '<p class="fnote">' + esc(p.facilityNotes) + '</p>' : '')) +
      section('후기 요약', reviewSummary(p) || '<p class="muted">요약할 후기를 모으는 중이에요.</p>') +
      section(naverInfo(p) && naverInfo(p).blog && naverInfo(p).blog.length ? '네이버 블로그 후기' : '후기 모아보기', blogBlock(p)) +
      section('인스타그램', instaBlock(p)) +
      section('기본 정보', infoBlock(p)) +
      sourceBlock(p);
    processInstagram();
  }

  function extrasBlock(p) {
    const inc = p.includes || [];
    const extra = p.extraFees || [];
    if (!inc.length && !extra.length) return '';
    return '<div class="extras">' +
      (inc.length ? '<p><span class="xlabel">요금에 포함</span>' + inc.map(esc).join(', ') + '</p>' : '') +
      (extra.length ? '<p><span class="xlabel">추가 요금</span>' + extra.map((x) => esc(x.label) + ' ' + (typeof x.price === 'number' ? won(x.price) : esc(x.price))).join(', ') + '</p>' : '') +
      '</div>';
  }

  function section(title, inner) {
    return '<section class="dsec"><h3 class="dsec-title">' + esc(title) + '</h3>' + inner + '</section>';
  }

  // ---------------------------------------------------------------- selection & routing
  function openDetail(id, opts) {
    const p = BY_ID[id];
    if (!p) return closeDetail();
    const wasList = !state.selectedId;
    if (wasList) listScrollTop = els.body.scrollTop;
    state.selectedId = id;
    renderDetail(p);
    els.list.hidden = true;
    els.empty.hidden = true;
    els.detail.hidden = false;
    els.panel.classList.add('has-detail');
    els.body.scrollTop = 0;
    if (isMobile() && state.sheet === 'peek') setSheet('half');
    refresh();
    if (mapApi && !(opts && opts.noFocus)) mapApi.focus(p, mapOffsetY());
    const h = $('#dName');
    if (h && !(opts && opts.noFocusHeading)) h.focus({ preventScroll: true });
  }

  function closeDetail() {
    if (!state.selectedId) return;
    const prev = state.selectedId;
    state.selectedId = null;
    els.detail.hidden = true;
    els.detail.innerHTML = '';
    els.list.hidden = false;
    els.panel.classList.remove('has-detail');
    refresh();
    els.body.scrollTop = listScrollTop;
    const card = els.list.querySelector('[data-id="' + CSS.escape(prev) + '"]');
    if (card) card.focus({ preventScroll: true });
  }

  function route() {
    const id = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (id && BY_ID[id]) openDetail(id);
    else closeDetail();
  }

  function mapOffsetY() {
    if (!isMobile()) return 0;
    return sheetVisibleHeight() / 2;
  }

  // ---------------------------------------------------------------- refresh
  function refresh(opts) {
    opts = opts || {};
    const list = filtered();
    renderList(list);
    if (mapApi) {
      mapApi.update(list.map((p) => p.id), state.selectedId);
      if (opts.fit && list.length) mapApi.fit(list, fitPadding());
    }
  }

  function fitPadding() {
    if (isMobile()) return { top: 70, right: 40, bottom: sheetVisibleHeight() + 30, left: 40 };
    return { top: 70, right: 70, bottom: 70, left: 70 };
  }

  // ---------------------------------------------------------------- mobile sheet
  function sheetVisibleHeight() {
    const h = window.innerHeight;
    if (state.sheet === 'full') return els.panel.offsetHeight;
    if (state.sheet === 'half') return Math.round(h * 0.52);
    return els.grip.offsetHeight + els.head.offsetHeight + 8;
  }

  function applySheet(dragY) {
    const mobile = isMobile();
    els.grip.tabIndex = mobile ? 0 : -1;
    if (mobile) els.grip.setAttribute('role', 'button'); else els.grip.removeAttribute('role');
    if (!mobile) { els.panel.style.transform = ''; return; }
    const H = els.panel.offsetHeight;
    const y = dragY != null ? dragY : Math.max(0, H - sheetVisibleHeight());
    els.panel.style.transform = 'translateY(' + y + 'px)';
    els.panel.dataset.sheet = state.sheet;
  }

  function setSheet(name) {
    state.sheet = name;
    applySheet();
  }

  function bindSheet() {
    let startY = 0, startT = 0, dragging = false, moved = 0;
    const currentY = () => {
      const m = /translateY\(([-\d.]+)px\)/.exec(els.panel.style.transform || '');
      return m ? parseFloat(m[1]) : 0;
    };
    els.grip.addEventListener('pointerdown', (e) => {
      if (!isMobile()) return;
      dragging = true; moved = 0;
      startY = e.clientY; startT = currentY();
      els.grip.setPointerCapture(e.pointerId);
      els.panel.classList.add('is-dragging');
    });
    els.grip.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dy = e.clientY - startY;
      moved = Math.max(moved, Math.abs(dy));
      const H = els.panel.offsetHeight;
      const minY = 0;
      const maxY = H - (els.grip.offsetHeight + els.head.offsetHeight + 8);
      applySheet(Math.min(maxY, Math.max(minY, startT + dy)));
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      els.panel.classList.remove('is-dragging');
      const dy = e.clientY - startY;
      const order = ['peek', 'half', 'full'];
      let i = order.indexOf(state.sheet);
      if (moved < 6) i = state.sheet === 'peek' ? 1 : state.sheet === 'half' ? 2 : 0;
      else if (dy < -40) i = Math.min(2, i + (dy < -260 ? 2 : 1));
      else if (dy > 40) i = Math.max(0, i - (dy > 260 ? 2 : 1));
      setSheet(order[i]);
    };
    els.grip.addEventListener('pointerup', end);
    els.grip.addEventListener('pointercancel', end);
    els.grip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setSheet(state.sheet === 'peek' ? 'half' : state.sheet === 'half' ? 'full' : 'peek');
      }
    });
    els.q.addEventListener('focus', () => { if (isMobile() && state.sheet !== 'full') setSheet('full'); });
    els.body.addEventListener('scroll', () => { if (isMobile() && state.sheet === 'half' && els.body.scrollTop > 24) setSheet('full'); }, { passive: true });
    window.addEventListener('resize', () => applySheet());
  }

  // ---------------------------------------------------------------- misc actions
  let toastTimer = 0;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    els.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.classList.remove('is-on'); els.toast.hidden = true; }, 2200);
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

  function locate() {
    if (!navigator.geolocation) { toast('이 브라우저에서는 위치를 쓸 수 없어요'); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      state.userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      refresh();
      toast('현재 위치에서 가까운 순으로 정렬했어요');
    }, () => {
      toast('위치 권한이 없어 거리순 정렬을 할 수 없어요');
      state.sort = 'rec';
      els.sort.value = 'rec';
      refresh();
    }, { timeout: 8000, maximumAge: 60000 });
  }

  function bindGlobalClicks() {
    document.addEventListener('click', (e) => {
      const fav = e.target.closest('[data-fav]');
      if (fav) { e.preventDefault(); toggleFav(fav.dataset.fav); return; }
      const cp = e.target.closest('[data-copy]');
      if (cp) { copyText(cp.dataset.copy); return; }
      const sh = e.target.closest('[data-share]');
      if (sh) {
        const url = location.href.split('#')[0] + '#' + sh.dataset.share;
        copyText(url, '링크를 복사했어요');
        return;
      }
      const card = e.target.closest('a.card');
      if (card && card.dataset.id === state.selectedId) {
        e.preventDefault();
        openDetail(card.dataset.id);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.selectedId) location.hash = '';
    });
  }

  // ---------------------------------------------------------------- map
  function pinHtml(p, selected) {
    const fav = state.favs.has(p.id);
    const price = p.minPrice ? shortWon(p.minPrice) : '?';
    const cls = 'pin' + (selected ? ' is-selected' : '') + (p.gender === 'female' ? ' is-female' : '') + (fav ? ' is-fav' : '');
    const label = p.name + ', ' + (p.minPrice ? won(p.minPrice) + '부터' : '가격 확인 중');
    return '<button type="button" class="' + cls + '" aria-label="' + esc(label) + '" title="' + esc(p.name) + '">' +
      (fav ? '<span class="pin-fav" aria-hidden="true">♥</span>' : '') +
      (p.gender === 'female' ? '<span class="pin-tag">여성</span>' : '') +
      '<span class="pin-price">' + esc(price) + '</span>' +
      (selected ? '<span class="pin-name">' + esc(p.name) + '</span>' : '') +
      '</button>';
  }

  const mapHandlers = {
    onMarkerClick(id) {
      lastMarkerClick = Date.now();
      if (location.hash.replace(/^#/, '') === id) openDetail(id);
      else location.hash = id;
    },
    onMapClick() {
      if (Date.now() - lastMarkerClick < 300) return;
      if (state.selectedId) location.hash = '';
      else if (isMobile() && state.sheet !== 'peek') setSheet('peek');
    }
  };

  function startMap(reason) {
    if (mapApi) mapApi.destroy();
    els.map.innerHTML = '';
    mapApi = new window.FallbackMap(els.map, mapHandlers);
    mapApi.setPlaces(PLACES, pinHtml);
    showNotice(reason);
  }

  function showNotice(reason) {
    const msgs = {
      preview: '미리보기라 간이 지도로 보여요. 실제 서비스는 네이버 지도를 써요.',
      nokey: '간이 지도로 보는 중이에요. js/config.js에 네이버 지도 키를 넣으면 바뀌어요.',
      auth: '네이버 지도 인증에 실패했어요. NCP 콘솔의 Key ID와 웹 서비스 URL을 확인해 주세요.',
      load: '네이버 지도를 불러오지 못해 간이 지도로 보여요.'
    };
    if (!reason) { els.notice.hidden = true; return; }
    els.notice.innerHTML = '<span>' + esc(msgs[reason] || msgs.load) + '</span><button type="button" class="mini" aria-label="안내 닫기">닫기</button>';
    els.notice.hidden = false;
    els.notice.querySelector('button').addEventListener('click', () => { els.notice.hidden = true; });
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
  function boot() {
    buildFilters();
    bindGlobalClicks();
    bindSheet();
    renderList(filtered());
    applySheet();
    initMap().then(() => {
      if (window.ResizeObserver) new ResizeObserver(() => mapApi && mapApi.resize()).observe(els.map);
      refresh();
      const startId = decodeURIComponent(location.hash.replace(/^#/, ''));
      if (startId && BY_ID[startId]) openDetail(startId, { noFocusHeading: true });
      else if (mapApi) mapApi.fit(PLACES, fitPadding());
    });
    window.addEventListener('hashchange', route);
  }

  boot();
})();
