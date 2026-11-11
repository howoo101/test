/*
 * 네이버 지도(NAVER Maps JavaScript API v3) 어댑터
 * - js/config.js 의 NAVER_MAP_KEY_ID 로 스크립트를 불러옵니다.
 *   (2025년 NCP 신규 Maps 상품부터 파라미터 이름이 ncpClientId -> ncpKeyId 로 바뀌었습니다)
 * - 간이 지도(map-fallback.js)와 같은 메서드를 제공합니다.
 */
(function () {
  'use strict';

  var SCRIPT_URL = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=';

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
    this.maps = maps;
    this.container = container;
    this.options = options || {};
    this.markers = {};
    var c = this.options.center || { lat: 37.5465, lng: 126.99 };
    this.map = new maps.Map(container, {
      center: new maps.LatLng(c.lat, c.lng),
      zoom: this.options.zoom || 11,
      minZoom: 9,
      zoomControl: true,
      zoomControlOptions: { position: maps.Position.TOP_RIGHT, style: maps.ZoomControlStyle.SMALL },
      mapTypeControl: false,
      scaleControl: true,
      logoControl: true,
      mapDataControl: true
    });
    var self = this;
    maps.Event.addListener(this.map, 'click', function () {
      if (self.options.onMapClick) self.options.onMapClick();
    });
  }

  NaverMap.prototype._icon = function (place, selected) {
    return {
      content: '<div class="pin-anchor' + (selected ? ' is-selected' : '') + '">' + this.pinHtml(place, selected) + '</div>',
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
        m.marker.setIcon(self._icon(m.place, sel));
        m.marker.setZIndex(sel ? 1000 : 10);
        m.selected = sel;
        m.dirty = false;
      }
    });
  };

  NaverMap.prototype.refreshPin = function (id) {
    var m = this.markers[id];
    if (m) { m.dirty = true; }
  };

  // offsetY: 모바일에서 아래 패널이 가리는 만큼 핀을 위로 올려 보여주기 위한 픽셀 값
  NaverMap.prototype.focus = function (place, offsetY) {
    var maps = this.maps;
    var map = this.map;
    var target = new maps.LatLng(place.lat, place.lng);
    if (map.getZoom() < 15) map.setZoom(15, false);
    if (offsetY) {
      try {
        var proj = map.getProjection();
        var pt = proj.fromCoordToOffset(target);
        target = proj.fromOffsetToCoord(new maps.Point(pt.x, pt.y + offsetY));
      } catch (e) {
        // 투영 API를 못 쓰면 오프셋 없이 가운데로 이동합니다.
      }
    }
    map.panTo(target);
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

  NaverMap.prototype.resize = function () {
    if (!this.map) return;
    var r = this.container.getBoundingClientRect();
    if (r.width && r.height && this.map.setSize) this.map.setSize(new this.maps.Size(r.width, r.height));
  };

  NaverMap.prototype.destroy = function () {
    var self = this;
    Object.keys(this.markers).forEach(function (id) { self.markers[id].marker.setMap(null); });
    if (this.map && this.map.destroy) this.map.destroy();
  };

  window.NaverMapAdapter = { load: loadNaverMaps, Map: NaverMap };
})();
