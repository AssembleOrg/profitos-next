(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  var FACE = 2560;
  var viewer, data, scenes = {}, order = [], current = null, spin = false, autorotate;

  fetch('scenes.json?v=1').then(function (r) { return r.json(); }).then(start);

  function start(d) {
    data = d;
    viewer = new Marzipano.Viewer($('pano'), { controls: { mouseViewMode: 'drag' }, stage: { progressive: true } });
    autorotate = Marzipano.autorotate({ yawSpeed: 0.035, targetPitch: 0.03 });
    var geometry = new Marzipano.CubeGeometry([
      { tileSize: 320, size: 320, fallbackOnly: true },
      { tileSize: 640, size: FACE / 4 }, { tileSize: 640, size: FACE / 2 }, { tileSize: 640, size: FACE }
    ]);
    var limiter = Marzipano.RectilinearView.limit.traditional(FACE * 1.35, 105 * Math.PI / 180, 112 * Math.PI / 180);
    var byId = {};
    d.scenes.forEach(function (s) { byId[s.id] = s; });
    d.scenes.forEach(function (s) {
      var base = 'tiles/' + s.id;
      var source = Marzipano.ImageUrlSource.fromString(base + '/{z}/{f}/{y}/{x}.webp?v=' + d.v, { cubeMapPreviewUrl: base + '/preview.jpg?v=' + d.v });
      var view = new Marzipano.RectilinearView(initial(s), limiter);
      // Marzipano guarda por defecto hasta 512 teselas ya vistas por escena: en un celular son cientos de MB de GPU.
      var scene = viewer.createScene({ source: source, geometry: geometry, view: view, pinFirstLevel: true, textureStoreOpts: { previouslyVisibleCacheSize: 48 } });
      (s.links || []).forEach(function (l) { hotspot(scene, s, byId[l.to], l); });
      scenes[s.id] = { s: s, scene: scene, view: view };
      order.push(s.id);
      chip(s);
    });
    plan(d);
    wire();
    guard();
    var first = location.hash.slice(1);
    go(scenes[first] ? first : order[0], true);
    setTimeout(function () { $('veil').classList.add('off'); }, 500);
  }

  // Campo de visión de entrada: 100° a lo ancho en apaisado, 100° a lo alto en vertical (Marzipano lo pide vertical).
  function initial(s) {
    var a = window.innerWidth / Math.max(1, window.innerHeight), h = 100 * Math.PI / 180;
    return { yaw: s.view.yaw, pitch: s.view.pitch, fov: a >= 1 ? 2 * Math.atan(Math.tan(h / 2) / a) : h };
  }

  // Dirección desde la cámara hacia un punto del modelo. El centro del pano mira al norte (+Y).
  function aim(from, to) {
    var dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
    return { yaw: Math.atan2(dx, dy), pitch: -Math.atan2(dz, Math.hypot(dx, dy)) };
  }

  function hotspot(scene, s, target, l) {
    var p = l.at;
    if (!p) {
      p = target.pos.slice();
      if (Math.abs(p[2] - s.pos[2]) < 1.2) p[2] -= 1.5;          // mismo piso: marca en el suelo
    }
    var a = aim(s.pos, p);
    a.pitch = Math.max(-1.2, Math.min(0.62, a.pitch));
    var el = document.createElement('button');
    el.type = 'button'; el.className = 'hs';
    el.innerHTML = '<i>' + ARROW + '</i><b>' + l.label + '</b>';
    el.addEventListener('click', function () { go(l.to); });
    scene.hotspotContainer().createHotspot(el, a);
  }

  function chip(s) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.id = s.id;
    b.innerHTML = '<img src="thumbs/' + s.id + '.webp?v=' + data.v + '" alt="" loading="lazy" width="480" height="300"><span>' + s.title + '</span>';
    b.addEventListener('click', function () { go(s.id); });
    $('strip').appendChild(b);
  }

  function go(id, instant) {
    if (id === current) { closePlan(); return; }
    var e = scenes[id], prev = scenes[current];
    current = id;
    e.view.setParameters(initial(e.s));
    e.scene.switchTo({ transitionDuration: instant || reduce ? 0 : 900 }, function () {
      // Al terminar el fundido se sueltan las texturas del ambiente anterior (queda solo su nivel base).
      if (prev && prev.s.id !== current) prev.scene.layer().textureStore().clearNotPinned();
    });
    $('title').textContent = e.s.title; $('sub').textContent = e.s.sub || '';
    document.title = e.s.title + ' · OLMO Residencias';
    Array.prototype.forEach.call(document.querySelectorAll('.chip, .pin'), function (c) {
      var on = c.dataset.id === id;
      c.setAttribute('aria-current', on ? 'true' : 'false');
      if (on && c.classList.contains('chip')) c.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    });
    if (history.replaceState) history.replaceState(null, '', '#' + id);
    closePlan();
    cone();
    idle();
  }

  function step(n) { go(order[(order.indexOf(current) + n + order.length) % order.length]); }

  function idle() {
    viewer.stopMovement();
    viewer.setIdleMovement(spin ? 2500 : Infinity, spin ? autorotate : null);
    if (spin) viewer.startMovement(autorotate);
  }

  // Si el navegador descarta el contexto WebGL (poca memoria, pestaña mucho tiempo en segundo plano) Marzipano
  // no lo recupera y el visor queda congelado: se recarga en el mismo ambiente, una sola vez cada 20 s.
  function guard() {
    viewer.stage().domElement().addEventListener('webglcontextlost', function (ev) {
      ev.preventDefault();
      try {
        var now = Date.now();
        if (now - (+sessionStorage.getItem('olmo-gl') || 0) < 20000) return;
        sessionStorage.setItem('olmo-gl', String(now));
      } catch (err) { return; }
      var reload = function () { location.reload(); };
      if (document.hidden) document.addEventListener('visibilitychange', reload, { once: true }); else reload();
    });
  }

  // ---- planta
  function pct(x, y) {
    var p = data.plan;
    return { left: (x - p.x0) / (p.x1 - p.x0) * 100 + '%', top: (p.y1 - y) / (p.y1 - p.y0) * 100 + '%' };
  }

  function plan(d) {
    var box = $('plan-box');
    d.plan.labels.forEach(function (l) {
      var e = document.createElement('div'); e.className = 'lbl';
      e.innerHTML = '<b>' + l.t + '</b>' + (l.s ? '<s>' + l.s + '</s>' : '');
      Object.assign(e.style, pct(l.x, l.y)); box.appendChild(e);
    });
    var c = document.createElement('div'); c.className = 'cone'; c.id = 'cone'; box.appendChild(c);
    d.scenes.filter(function (s) { return s.plan; }).forEach(function (s) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'pin'; b.dataset.id = s.id;
      b.title = s.title; b.setAttribute('aria-label', 'Ir a ' + s.title);
      Object.assign(b.style, pct(s.pos[0], s.pos[1]));
      b.addEventListener('click', function () { go(s.id); });
      box.appendChild(b);
    });
  }

  function cone() {
    var c = $('cone'), e = scenes[current];
    if (!c || !e) return;
    c.style.display = e.s.plan ? '' : 'none';
    if (!e.s.plan) return;
    Object.assign(c.style, pct(e.s.pos[0], e.s.pos[1]));
    c.style.transform = 'rotate(' + e.view.yaw() + 'rad)';
  }

  function openPlan() { $('plan').hidden = false; cone(); $('b-close').focus(); }
  function closePlan() { if (!$('plan').hidden) { $('plan').hidden = true; $('b-plan').focus(); } }

  // ---- controles
  function wire() {
    $('b-prev').addEventListener('click', function () { step(-1); });
    $('b-next').addEventListener('click', function () { step(1); });
    $('b-plan').addEventListener('click', openPlan);
    $('b-close').addEventListener('click', closePlan);
    $('plan').addEventListener('click', function (ev) { if (ev.target === $('plan')) closePlan(); });
    $('b-spin').addEventListener('click', function () {
      spin = !spin; this.setAttribute('aria-pressed', spin ? 'true' : 'false'); idle();
    });
    var full = $('b-full'), root = document.documentElement;
    if (!root.requestFullscreen) full.style.display = 'none';
    full.addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen(); else root.requestFullscreen();
    });
    var hint = $('hint');
    var off = function () { hint.classList.add('off'); };
    $('pano').addEventListener('pointerdown', off, { once: true });
    setTimeout(off, 7000);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') return closePlan();
      if (!$('plan').hidden || /^(BUTTON|INPUT)$/.test(ev.target.tagName) && ev.key === ' ') return;
      var v = scenes[current].view, k = ev.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight') { turn(v, (k === 'ArrowLeft' ? -1 : 1) * 0.35, 0); ev.preventDefault(); }
      else if (k === 'ArrowUp' || k === 'ArrowDown') { turn(v, 0, (k === 'ArrowUp' ? -1 : 1) * 0.2); ev.preventDefault(); }
      else if (k === 'PageDown' || k === ']') step(1);
      else if (k === 'PageUp' || k === '[') step(-1);
      else if (k === '+' || k === '=') v.setFov(v.fov() * 0.85);
      else if (k === '-') v.setFov(v.fov() / 0.85);
    });
    viewer.addEventListener('viewChange', cone);
  }

  var anim = null;
  function turn(view, dyaw, dpitch) {
    cancelAnimationFrame(anim);
    var y0 = view.yaw(), p0 = view.pitch(), t0 = performance.now(), T = reduce ? 1 : 320;
    (function tick(t) {
      var k = Math.min(1, (t - t0) / T); k = 1 - Math.pow(1 - k, 3);
      view.setYaw(y0 + dyaw * k); view.setPitch(p0 + dpitch * k);
      if (k < 1) anim = requestAnimationFrame(tick);
    })(t0);
  }
})();
