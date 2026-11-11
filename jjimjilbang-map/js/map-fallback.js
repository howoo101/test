/*
 * 간이 지도 (네이버 지도 키가 없거나 불러오지 못했을 때 사용)
 * - 서울 25개 구 경계와 한강을 SVG로 그리고, 찜질방 핀은 HTML로 올립니다.
 * - 드래그 이동, 휠/핀치 확대, +/- 버튼을 지원합니다.
 * - 네이버 지도 어댑터(map-naver.js)와 같은 메서드를 제공합니다:
 *   setPlaces, update, focus, fit, resize, destroy
 */
(function () {
  'use strict';

  var LAT0 = 37.56;
  var COS0 = Math.cos(LAT0 * Math.PI / 180);
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // 경위도 -> 평면 좌표 (단위: 약 0.001도). y는 아래로 증가.
  function project(lng, lat) {
    return { x: (lng - 126.98) * COS0 * 1000, y: (LAT0 - lat) * 1000 };
  }

  function el(tag, attrs, ns) {
    var node = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    }
    return node;
  }

  function ringToPath(ring) {
    var d = '';
    for (var i = 0; i < ring.length; i++) {
      var p = project(ring[i][0], ring[i][1]);
      d += (i ? 'L' : 'M') + p.x.toFixed(2) + ' ' + p.y.toFixed(2);
    }
    return d + 'Z';
  }

  function FallbackMap(container, options) {
    this.container = container;
    this.options = options || {};
    this.geo = window.SEOUL_GEO;
    this.markers = {};
    this.places = [];
    this.view = { cx: 0, cy: 0, k: 1 };
    this.pointers = {};
    this._raf = 0;
    this._build();
  }

  FallbackMap.prototype._build = function () {
    var self = this;
    var root = el('div', { 'class': 'fmap' });
    var svg = el('svg', { 'class': 'fmap-svg', 'aria-hidden': 'true' }, SVG_NS);
    var gLand = el('g', { 'class': 'fmap-land' }, SVG_NS);
    var bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

    this.geo.districts.forEach(function (d) {
      var path = el('path', { d: d.rings.map(ringToPath).join(' '), 'class': 'fmap-gu', 'vector-effect': 'non-scaling-stroke' }, SVG_NS);
      path.setAttribute('data-gu', d.name);
      gLand.appendChild(path);
      d.rings.forEach(function (ring) {
        ring.forEach(function (c) {
          var p = project(c[0], c[1]);
          if (p.x < bounds.minX) bounds.minX = p.x;
          if (p.y < bounds.minY) bounds.minY = p.y;
          if (p.x > bounds.maxX) bounds.maxX = p.x;
          if (p.y > bounds.maxY) bounds.maxY = p.y;
        });
      });
    });

    var gRiver = el('g', { 'class': 'fmap-river' }, SVG_NS);
    (this.geo.river || []).forEach(function (line) {
      var d = line.map(function (c, i) {
        var p = project(c[0], c[1]);
        return (i ? 'L' : 'M') + p.x.toFixed(2) + ' ' + p.y.toFixed(2);
      }).join('');
      gRiver.appendChild(el('path', { d: d, 'class': 'fmap-river-line' }, SVG_NS));
    });

    svg.appendChild(gLand);
    svg.appendChild(gRiver);

    var labels = el('div', { 'class': 'fmap-labels', 'aria-hidden': 'true' });
    this.labelNodes = this.geo.districts.map(function (d) {
      var node = el('span', { 'class': 'fmap-label' });
      node.textContent = d.name;
      labels.appendChild(node);
      return { node: node, p: project(d.label[0], d.label[1]) };
    });

    var pins = el('div', { 'class': 'fmap-pins' });

    var controls = el('div', { 'class': 'fmap-controls' });
    [['+', '지도 확대', function () { self.zoomBy(1.6); }],
     ['−', '지도 축소', function () { self.zoomBy(1 / 1.6); }],
     ['⤢', '서울 전체 보기', function () { self.fitSeoul(); }]].forEach(function (c) {
      var b = el('button', { type: 'button', 'class': 'fmap-btn', 'aria-label': c[1], title: c[1] });
      b.textContent = c[0];
      b.addEventListener('click', c[2]);
      controls.appendChild(b);
    });

    var credit = el('div', { 'class': 'fmap-credit' });
    credit.textContent = '간이 지도 · 행정구역 경계 © 통계청(2013)';

    root.appendChild(svg);
    root.appendChild(labels);
    root.appendChild(pins);
    root.appendChild(controls);
    root.appendChild(credit);
    this.container.appendChild(root);

    this.root = root;
    this.svg = svg;
    this.pinLayer = pins;
    this.seoulBounds = bounds;
    this._bindGestures();
    this.resize();
    this.fitSeoul(true);
  };

  FallbackMap.prototype._bindGestures = function () {
    var self = this;
    var root = this.root;
    var moved = 0;
    var last = null;

    function midpoint() {
      var ids = Object.keys(self.pointers);
      var a = self.pointers[ids[0]], b = self.pointers[ids[1]];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
    }

    root.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.pin, .fmap-btn')) return;
      root.setPointerCapture(e.pointerId);
      self.pointers[e.pointerId] = self._local(e);
      moved = 0;
      last = Object.keys(self.pointers).length === 2 ? midpoint() : self._local(e);
      root.classList.add('is-dragging');
    });

    root.addEventListener('pointermove', function (e) {
      if (!self.pointers[e.pointerId]) return;
      self.pointers[e.pointerId] = self._local(e);
      var count = Object.keys(self.pointers).length;
      if (count === 2) {
        var m = midpoint();
        if (last && last.d) {
          self._zoomAt(m.d / last.d, m);
          self.view.cx -= (m.x - last.x) / self.view.k;
          self.view.cy -= (m.y - last.y) / self.view.k;
        }
        moved += 10;
        last = m;
      } else if (count === 1) {
        var p = self._local(e);
        var dx = p.x - last.x, dy = p.y - last.y;
        moved += Math.abs(dx) + Math.abs(dy);
        self.view.cx -= dx / self.view.k;
        self.view.cy -= dy / self.view.k;
        last = p;
      }
      self._schedule();
    });

    function end(e) {
      if (!self.pointers[e.pointerId]) return;
      delete self.pointers[e.pointerId];
      var count = Object.keys(self.pointers).length;
      if (count === 0) {
        root.classList.remove('is-dragging');
        if (moved < 6 && e.type === 'pointerup' && self.options.onMapClick) self.options.onMapClick();
      } else {
        var id = Object.keys(self.pointers)[0];
        last = self.pointers[id];
      }
    }
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);

    root.addEventListener('wheel', function (e) {
      e.preventDefault();
      var factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018));
      self._zoomAt(factor, self._local(e));
      self._schedule();
    }, { passive: false });

    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(function () { self.resize(); });
      this._ro.observe(this.container);
    } else {
      window.addEventListener('resize', function () { self.resize(); });
    }
  };

  FallbackMap.prototype._local = function (e) {
    var r = this.root.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  FallbackMap.prototype._clampK = function (k) {
    var min = this.minK || 0.5;
    return Math.max(min * 0.8, Math.min(min * 40, k));
  };

  FallbackMap.prototype._zoomAt = function (factor, screenPt) {
    var v = this.view;
    var k2 = this._clampK(v.k * factor);
    var mx = v.cx + (screenPt.x - this.w / 2) / v.k;
    var my = v.cy + (screenPt.y - this.h / 2) / v.k;
    v.cx = mx - (screenPt.x - this.w / 2) / k2;
    v.cy = my - (screenPt.y - this.h / 2) / k2;
    v.k = k2;
  };

  FallbackMap.prototype.zoomBy = function (factor) {
    this._zoomAt(factor, { x: this.w / 2, y: this.h / 2 });
    this._render();
  };

  FallbackMap.prototype._schedule = function () {
    var self = this;
    if (this._raf) return;
    this._raf = requestAnimationFrame(function () { self._raf = 0; self._render(); });
  };

  FallbackMap.prototype.resize = function () {
    var r = this.root.getBoundingClientRect();
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    var b = this.seoulBounds;
    this.minK = Math.min(this.w / (b.maxX - b.minX), this.h / (b.maxY - b.minY)) * 0.92;
    this._render();
  };

  FallbackMap.prototype._toScreen = function (p) {
    var v = this.view;
    return { x: (p.x - v.cx) * v.k + this.w / 2, y: (p.y - v.cy) * v.k + this.h / 2 };
  };

  FallbackMap.prototype._render = function () {
    var v = this.view;
    var vw = this.w / v.k, vh = this.h / v.k;
    this.svg.setAttribute('viewBox', [v.cx - vw / 2, v.cy - vh / 2, vw, vh].map(function (n) { return n.toFixed(3); }).join(' '));
    var self = this;
    var showLabels = v.k > this.minK * 0.9;
    this.labelNodes.forEach(function (l) {
      var s = self._toScreen(l.p);
      l.node.style.transform = 'translate(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px) translate(-50%,-50%)';
      l.node.hidden = !showLabels;
    });
    Object.keys(this.markers).forEach(function (id) {
      var m = self.markers[id];
      var s = self._toScreen(m.p);
      m.node.style.transform = 'translate(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px)';
    });
  };

  // ---- 공통 어댑터 메서드 ----

  FallbackMap.prototype.setPlaces = function (places, pinHtml) {
    var self = this;
    this.pinLayer.innerHTML = '';
    this.markers = {};
    this.places = places;
    this.pinHtml = pinHtml;
    places.forEach(function (place) {
      var holder = el('div', { 'class': 'pin-anchor' });
      holder.innerHTML = pinHtml(place, false);
      holder.addEventListener('click', function (e) {
        e.stopPropagation();
        if (self.options.onMarkerClick) self.options.onMarkerClick(place.id);
      });
      self.pinLayer.appendChild(holder);
      self.markers[place.id] = { node: holder, p: project(place.lng, place.lat), place: place, selected: false };
    });
    this._render();
  };

  FallbackMap.prototype.update = function (visibleIds, selectedId) {
    var self = this;
    var visible = {};
    visibleIds.forEach(function (id) { visible[id] = true; });
    Object.keys(this.markers).forEach(function (id) {
      var m = self.markers[id];
      m.node.hidden = !visible[id] && id !== selectedId;
      var sel = id === selectedId;
      if (sel !== m.selected || m.dirty) {
        m.node.innerHTML = self.pinHtml(m.place, sel);
        m.selected = sel;
        m.dirty = false;
      }
      m.node.classList.toggle('is-selected', sel);
    });
  };

  FallbackMap.prototype.refreshPin = function (id) {
    var m = this.markers[id];
    if (m) { m.dirty = true; }
  };

  // 화면 아래쪽이 패널로 가려질 때(모바일) offsetY 만큼 핀을 위로 올려 보여줍니다.
  FallbackMap.prototype.focus = function (place, offsetY) {
    var p = project(place.lng, place.lat);
    var targetK = Math.max(this.view.k, this.minK * 3.2);
    this._animateTo(p.x, p.y + (offsetY || 0) / targetK, targetK);
  };

  FallbackMap.prototype.fit = function (places, padding) {
    if (!places.length) return this.fitSeoul();
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    places.forEach(function (pl) {
      var p = project(pl.lng, pl.lat);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    var pad = padding || { top: 60, right: 60, bottom: 60, left: 60 };
    var availW = Math.max(40, this.w - pad.left - pad.right);
    var availH = Math.max(40, this.h - pad.top - pad.bottom);
    var k = Math.min(availW / Math.max(4, maxX - minX), availH / Math.max(4, maxY - minY));
    k = this._clampK(Math.min(k, this.minK * 6));
    var cx = (minX + maxX) / 2 - (pad.left - pad.right) / 2 / k;
    var cy = (minY + maxY) / 2 - (pad.top - pad.bottom) / 2 / k;
    this._animateTo(cx, cy, k);
  };

  FallbackMap.prototype.fitSeoul = function (instant) {
    var b = this.seoulBounds;
    var cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    if (instant) {
      this.view = { cx: cx, cy: cy, k: this.minK };
      this._render();
    } else {
      this._animateTo(cx, cy, this.minK);
    }
  };

  FallbackMap.prototype._animateTo = function (cx, cy, k) {
    var self = this;
    var from = { cx: this.view.cx, cy: this.view.cy, k: this.view.k };
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      this.view = { cx: cx, cy: cy, k: k };
      return this._render();
    }
    var start = performance.now();
    var dur = 380;
    cancelAnimationFrame(this._anim);
    function step(t) {
      var u = Math.min(1, (t - start) / dur);
      var e = 1 - Math.pow(1 - u, 3);
      self.view.cx = from.cx + (cx - from.cx) * e;
      self.view.cy = from.cy + (cy - from.cy) * e;
      self.view.k = from.k * Math.pow(k / from.k, e);
      self._render();
      if (u < 1) self._anim = requestAnimationFrame(step);
    }
    this._anim = requestAnimationFrame(step);
  };

  FallbackMap.prototype.destroy = function () {
    if (this._ro) this._ro.disconnect();
    cancelAnimationFrame(this._anim);
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
  };

  window.FallbackMap = FallbackMap;
})();
