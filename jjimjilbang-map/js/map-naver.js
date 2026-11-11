/*
 * 네이버 지도(NAVER Maps JavaScript API v3) 어댑터
 * - js/config.js 의 NAVER_MAP_KEY_ID 로 스크립트를 불러옵니다.
 *   (2025년 NCP 신규 Maps 상품부터 파라미터 이름이 ncpClientId -> ncpKeyId 로 바뀌었습니다)
 * - 간이 지도(map-fallback.js)와 같은 메서드를 제공합니다.
 * - 확대·축소·내 위치 버튼은 app.js 가 직접 그리므로 네이버 기본 줌 컨트롤은 끕니다.
 *   (네이버 로고와 지도 데이터 저작권 표시는 약관상 그대로 둡니다)
 */
(function () {
  'use strict';

  var SCRIPT_URL = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=';
  var LABEL_ZOOM = 14;

  function loadNaverMaps(keyId, timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (window.naver && window.naver.maps && window.naver.maps.Map) return resolve(window.naver.maps);
      var done = false;
      var script = document.createElement('script');
      script.src = SCRIPT_URL + encodeURIComponent(keyId);
      script.async = true;
      script.onload = function () {
        if (done) return;
        done = true;
        if (window.naver && window.naver.maps) resolve(window.naver.maps);
        else reject(new Error('NAVER_MAPS_MISSING'));
      };
      script.onerror = function () {
        if (done) return;
        done = true;
        reject(new Error('NAVER_MAPS_LOAD_FAILED'));
      };
      setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error('NAVER_MAPS_TIMEOUT'));
      }, timeoutMs || 8000);
      document.head.appendChild(script);
    });
  }

  function NaverMap(container, options) {
    var maps = window.naver.maps;
    var self = this;
    this.maps = maps;
    this.container = container;
    this.options = options || {};
    this.markers = {};
    var c = this.options.center || { lat: 37.5465, lng: 126.99 };
    this.map = new maps.Map(container, {
      center: new maps.LatLng(c.lat, c.lng),
      zoom: this.options.zoom || 11,
      minZoom: 9,
      zoomControl: false,
      mapTypeControl: false,
      scaleControl: true,
      logoControl: true,
      mapDataControl: true
    });
    maps.Event.addListener(this.map, 'click', function () {
      if (self.options.onMapClick) self.options.onMapClick();
    });
    maps.Event.addListener(this.map, 'dragend', function () {
      if (self.options.onViewChange) self.options.onViewChange();
    });
    maps.Event.addListener(this.map, 'zoom_changed', function () {
      self._syncLabels();
      if (self.options.onZoomChange) self.options.onZoomChange();
      if (self.options.onViewChange) self.options.onViewChange();
    });
    this._syncLabels();
  }

  // 많이 확대했을 때만 핀 아래에 이름을 보여줍니다 (네이버 지도 앱과 같은 방식)
  NaverMap.prototype._syncLabels = function () {
    this.container.classList.toggle('show-labels', this.map.getZoom() >= LABEL_ZOOM);
  };

  NaverMap.prototype._icon = function (place, selected, compact) {
    return {
      content: '<div class="pin-anchor' + (selected ? ' is-selected' : '') + (compact ? ' is-compact' : '') + '">' + this.pinHtml(place, selected, compact) + '</div>',
      anchor: new this.maps.Point(0, 0)
    };
  };

  NaverMap.prototype.setPlaces = function (places, pinHtml) {
    var self = this;
    var maps = this.maps;
    this.pinHtml = pinHtml;
    Object.keys(this.markers).forEach(function (id) { self.markers[id].marker.setMap(null); });
    this.markers = {};
    places.forEach(function (place) {
      var marker = new maps.Marker({
        position: new maps.LatLng(place.lat, place.lng),
        map: self.map,
        title: place.name,
        icon: self._icon(place, false),
        zIndex: 10
      });
      maps.Event.addListener(marker, 'click', function () {
        if (self.options.onMarkerClick) self.options.onMarkerClick(place.id);
      });
      self.markers[place.id] = { marker: marker, place: place, selected: false };
    });
  };

  NaverMap.prototype.update = function (visibleIds, selectedId) {
    var self = this;
    var visible = {};
    visibleIds.forEach(function (id) { visible[id] = true; });
    Object.keys(this.markers).forEach(function (id) {
      var m = self.markers[id];
      var sel = id === selectedId;
      m.marker.setVisible(!!visible[id] || sel);
      if (sel !== m.selected || m.dirty) {
        m.marker.setIcon(self._icon(m.place, sel, m.compact));
        m.marker.setZIndex(sel ? 1000 : m.compact ? 5 : 10);
        m.selected = sel;
        m.dirty = false;
      }
    });
  };

  // 겹치는 핀을 작은 점으로 바꿉니다 (app.js 가 어떤 핀을 줄일지 정해 줌)
  NaverMap.prototype.setCompact = function (set) {
    var self = this;
    Object.keys(this.markers).forEach(function (id) {
      var m = self.markers[id];
      var c = set.has(id);
      if (c === !!m.compact) return;
      m.compact = c;
      m.marker.setIcon(self._icon(m.place, m.selected, c));
      m.marker.setZIndex(m.selected ? 1000 : c ? 5 : 10);
    });
  };

  // 겹침 계산용 화면 좌표 (현재 확대 수준의 픽셀 좌표)
  NaverMap.prototype.toPixel = function (lat, lng) {
    try {
      var pt = this.map.getProjection().fromCoordToOffset(new this.maps.LatLng(lat, lng));
      return { x: pt.x, y: pt.y };
    } catch (e) {
      return null;
    }
  };

  NaverMap.prototype.refreshPin = function (id) {
    if (this.markers[id]) this.markers[id].dirty = true;
  };

  // offsetX/offsetY: 패널에 가려지는 만큼 핀을 오른쪽/위로 옮겨 보이게 하는 픽셀 값
  NaverMap.prototype.panToLatLng = function (lat, lng, offsetX, offsetY, minZoom) {
    var maps = this.maps;
    var map = this.map;
    var target = new maps.LatLng(lat, lng);
    if (map.getZoom() < (minZoom || 15)) map.setZoom(minZoom || 15, false);
    if (offsetX || offsetY) {
      try {
        var proj = map.getProjection();
        var pt = proj.fromCoordToOffset(target);
        target = proj.fromOffsetToCoord(new maps.Point(pt.x - (offsetX || 0), pt.y + (offsetY || 0)));
      } catch (e) {
        // 투영 API를 못 쓰면 오프셋 없이 가운데로 이동합니다.
      }
    }
    map.panTo(target);
  };

  NaverMap.prototype.focus = function (place, offsetX, offsetY) {
    this.panToLatLng(place.lat, place.lng, offsetX, offsetY, 15);
  };

  NaverMap.prototype.fit = function (places, padding) {
    if (!places.length) return;
    var maps = this.maps;
    if (places.length === 1) {
      this.map.setCenter(new maps.LatLng(places[0].lat, places[0].lng));
      this.map.setZoom(15);
      return;
    }
    var bounds = new maps.LatLngBounds(
      new maps.LatLng(places[0].lat, places[0].lng),
      new maps.LatLng(places[0].lat, places[0].lng)
    );
    places.forEach(function (p) { bounds.extend(new maps.LatLng(p.lat, p.lng)); });
    this.map.fitBounds(bounds, padding || { top: 60, right: 60, bottom: 60, left: 60 });
  };

  NaverMap.prototype.zoomBy = function (steps) {
    this.map.setZoom(this.map.getZoom() + steps, true);
  };

  NaverMap.prototype.getBounds = function () {
    var maps = this.maps;
    var b = this.map.getBounds();
    return {
      contains: function (lat, lng) {
        var ll = new maps.LatLng(lat, lng);
        if (b.hasLatLng) return b.hasLatLng(ll);
        return b.hasPoint ? b.hasPoint(ll) : true;
      }
    };
  };

  NaverMap.prototype.setUserPosition = function (pos) {
    var maps = this.maps;
    var latlng = new maps.LatLng(pos.lat, pos.lng);
    if (!this.me) {
      this.me = new maps.Marker({
        position: latlng,
        map: this.map,
        clickable: false,
        zIndex: 5,
        icon: { content: '<div class="me-anchor"><span class="me-dot"></span></div>', anchor: new maps.Point(0, 0) }
      });
    } else {
      this.me.setPosition(latlng);
    }
  };

  NaverMap.prototype.resize = function () {
    if (!this.map) return;
    var r = this.container.getBoundingClientRect();
    if (r.width && r.height && this.map.setSize) this.map.setSize(new this.maps.Size(r.width, r.height));
  };

  NaverMap.prototype.destroy = function () {
    var self = this;
    Object.keys(this.markers).forEach(function (id) { self.markers[id].marker.setMap(null); });
    if (this.me) this.me.setMap(null);
    this.container.classList.remove('show-labels');
    if (this.map && this.map.destroy) this.map.destroy();
  };

  window.NaverMapAdapter = { load: loadNaverMaps, Map: NaverMap };
})();
