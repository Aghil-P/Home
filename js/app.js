/* ==========================================================================
   Application shell: navigation, section rendering, theme, and the wiring
   between the plans, the guided tour and the 3D walkthrough.
   ========================================================================== */

(function () {
  'use strict';

  var V = window.VILLA;
  var X = window.Explorer;
  var e = X.el, icon = X.icon, esc = X.esc;

  var app = {
    section: 'home',
    theme: 'day',
    planFloor: 'ground',
    planZones: false,
    pz: null,
    shapes: {}
  };

  var dom = {};

  /* ------------------------------------------------------------- theme */

  function setTheme(theme) {
    app.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    dom.themeBtn.innerHTML = icon(theme === 'night' ? 'sun' : 'moon');
    dom.themeBtn.setAttribute('aria-label',
      theme === 'night' ? 'Switch to day view' : 'Switch to night view');
    try { localStorage.setItem('haven-theme', theme); } catch (err) { /* private mode */ }
    if (window.Walk) window.Walk.applyTheme(theme);
  }

  /* ---------------------------------------------------------- navigation */

  function buildNav(host, closeOnPick) {
    host.innerHTML = '';
    var groups = [
      { title: 'Overview', ids: ['home', 'site', 'ground', 'first'] },
      { title: 'Inside', ids: ['courtyard', 'living', 'kitchen', 'bedrooms',
        'master', 'theatre', 'gym', 'travel'] },
      { title: 'Outside', ids: ['pool', 'gardens', 'outdoor', 'well', 'exterior'] }
    ];
    groups.forEach(function (g) {
      var box = e('div', 'nav__group');
      box.appendChild(e('div', 'nav__title', g.title));
      g.ids.forEach(function (id) {
        var s = sectionById(id);
        if (!s) return;
        var b = e('button', 'nav__item', icon(s.icon) + '<span>' + esc(s.label) + '</span>');
        b.type = 'button';
        b.setAttribute('data-nav', id);
        b.addEventListener('click', function () {
          go(id);
          if (closeOnPick) setDrawer(false);
        });
        box.appendChild(b);
      });
      host.appendChild(box);
    });
  }

  function sectionById(id) {
    var out = null;
    V.sections.forEach(function (s) { if (s.id === id) out = s; });
    return out;
  }

  function markNav() {
    document.querySelectorAll('[data-nav]').forEach(function (n) {
      n.setAttribute('aria-current',
        n.getAttribute('data-nav') === app.section ? 'true' : 'false');
    });
  }

  function setDrawer(open) {
    dom.drawer.setAttribute('data-open', String(open));
    dom.scrim.setAttribute('data-open', String(open));
  }

  /* -------------------------------------------------------------- router */

  function go(id, opts) {
    var s = sectionById(id);
    if (!s) { id = 'home'; s = sectionById('home'); }
    app.section = id;
    if (location.hash !== '#' + id) {
      history.replaceState(null, '', '#' + id);
    }
    markNav();
    X.hideRoom();
    renderSection(s, opts || {});
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ------------------------------------------------------------ sections */

  function renderSection(s, opts) {
    var main = dom.main;
    main.innerHTML = '';

    if (s.kind === 'home') { renderHome(main); return; }

    var wrap = e('div', 'wrap');
    wrap.appendChild(X.sectionHead(s));
    main.appendChild(wrap);

    if (s.kind === 'plan') {
      renderPlan(wrap, s.floor, s, opts);
    } else if (s.kind === 'siteplan') {
      renderPlan(wrap, 'site', s, opts);
    } else if (s.kind === 'rooms') {
      renderRooms(wrap, s);
    } else if (s.kind === 'gallery') {
      wrap.appendChild(X.galleryOf(s.images));
    }

    wrap.appendChild(footer());
  }

  /* ---- home ---- */

  function renderHome(main) {
    var hero = e('section', 'hero');
    var im = X.img('elevation-front', 'The Tropical Haven from the north road');
    im.className = 'hero__img';
    im.loading = 'eager';
    hero.appendChild(im);

    var inner = e('div', 'hero__inner');
    inner.appendChild(e('div', 'hero__eyebrow', esc(V.meta.subtitle)));
    inner.appendChild(e('h1', null, esc(V.meta.title)));
    inner.appendChild(e('p', 'hero__tag', esc(V.meta.tagline)));

    var acts = e('div', 'hero__actions');
    var walk = e('button', 'btn btn--primary',
      icon('walk') + '<span>Walk through the house</span>');
    walk.addEventListener('click', function () { openWalk('main-gate'); });
    acts.appendChild(walk);

    var tour = e('button', 'btn', icon('play') + '<span>Guided tour</span>');
    tour.addEventListener('click', function () { window.Tour.open('arrival'); });
    acts.appendChild(tour);

    var plans = e('button', 'btn', icon('plan') + '<span>Floor plans</span>');
    plans.addEventListener('click', function () { go('ground'); });
    acts.appendChild(plans);

    inner.appendChild(acts);
    hero.appendChild(inner);
    main.appendChild(hero);

    var wrap = e('div', 'wrap');

    /* stats */
    var stats = e('div', 'stats');
    V.stats.forEach(function (st) {
      var c = e('div', 'stat');
      c.appendChild(e('div', 'stat__label', esc(st.label)));
      c.appendChild(e('div', 'stat__value', esc(st.value)));
      if (st.note) c.appendChild(e('div', 'stat__note', esc(st.note)));
      stats.appendChild(c);
    });
    wrap.appendChild(stats);

    var intro = e('div', 'section-head');
    intro.appendChild(e('h2', null, 'The idea'));
    intro.appendChild(e('p', null, esc(V.meta.summary)));
    wrap.appendChild(intro);

    /* routes */
    wrap.appendChild(e('div', 'section-head',
      '<div class="section-head__eyebrow">Move through it</div>' +
      '<h2>Guided routes</h2><p>Each route follows one of the circulation ' +
      'sequences the house is planned around.</p>'));

    var list = e('div', 'routelist');
    V.routes.forEach(function (r, i) {
      var card = e('button', 'routecard');
      card.type = 'button';
      card.appendChild(e('div', 'routecard__n', String(i + 1).padStart(2, '0')));
      var b = e('div', 'routecard__b');
      b.appendChild(e('div', 'routecard__t', esc(r.name)));
      b.appendChild(e('div', 'routecard__d', esc(r.blurb)));
      card.appendChild(b);
      card.appendChild(e('div', null, icon('right')));
      card.addEventListener('click', function () { window.Tour.open(r.id); });
      list.appendChild(card);
    });
    wrap.appendChild(list);

    /* privacy zones */
    wrap.appendChild(e('div', 'section-head',
      '<div class="section-head__eyebrow">Planning</div>' +
      '<h2>From public to private</h2><p>The property steps through four ' +
      'zones, and that gradient is visible on every plan.</p>'));

    var zg = e('div', 'zonegrid');
    V.zones.forEach(function (z) {
      var c = e('div', 'zonecard');
      c.style.borderLeftColor = z.color;
      c.appendChild(e('h4', null, esc(z.name)));
      c.appendChild(e('p', null, esc(z.blurb)));
      zg.appendChild(c);
    });
    wrap.appendChild(zg);

    /* materials */
    wrap.appendChild(e('div', 'section-head',
      '<div class="section-head__eyebrow">Palette</div><h2>Materials</h2>' +
      '<p>Warm wood, natural stone, off-white walls and a lot of glass ' +
      'facing greenery.</p>'));

    ['exterior', 'interior'].forEach(function (k) {
      wrap.appendChild(e('h4', null,
        '<span style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;' +
        'color:var(--muted)">' + k + '</span>'));
      var sw = e('div', 'swatches');
      V.materials[k].forEach(function (m) {
        var s = e('div', 'swatch');
        var i2 = document.createElement('i');
        i2.style.background = m.hex;
        s.appendChild(i2);
        s.appendChild(document.createTextNode(m.name));
        sw.appendChild(s);
      });
      wrap.appendChild(sw);
    });

    /* highlights */
    wrap.appendChild(e('div', 'section-head',
      '<div class="section-head__eyebrow">Explore</div><h2>Highlights</h2>'));
    var cards = e('div', 'cards');
    ['courtyard', 'master-bedroom', 'main-pool', 'home-theatre', 'travel-room',
      'gym', 'fruit-garden', 'well'].forEach(function (id) {
      var r = V.byId(id);
      if (r) cards.appendChild(X.roomCard(r, openRoom));
    });
    wrap.appendChild(cards);

    wrap.appendChild(footer());
    main.appendChild(wrap);
  }

  /* ---- plan sections ---- */

  function renderPlan(wrap, floor, s, opts) {
    app.planFloor = floor;

    var tools = e('div', 'plantools');

    if (floor !== 'site') {
      var seg = e('div', 'seg');
      [['ground', 'Ground'], ['first', 'First']].forEach(function (f) {
        var b = e('button', null, f[1]);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(floor === f[0]));
        b.addEventListener('click', function () { go(f[0]); });
        seg.appendChild(b);
      });
      tools.appendChild(seg);
    }

    var zoneBtn = e('button', 'btn', icon('layers') + '<span>Privacy zones</span>');
    zoneBtn.setAttribute('aria-pressed', String(app.planZones));
    zoneBtn.addEventListener('click', function () {
      app.planZones = !app.planZones;
      renderSection(s, { keepScroll: true });
    });
    if (app.planZones) {
      zoneBtn.classList.add('btn--primary');
    }
    tools.appendChild(zoneBtn);

    var zin = e('button', 'iconbtn', icon('plus'));
    zin.setAttribute('aria-label', 'Zoom in');
    var zout = e('button', 'iconbtn', icon('minus'));
    zout.setAttribute('aria-label', 'Zoom out');
    var zres = e('button', 'iconbtn', icon('reset'));
    zres.setAttribute('aria-label', 'Reset view');
    tools.appendChild(zin);
    tools.appendChild(zout);
    tools.appendChild(zres);

    var walkBtn = e('button', 'btn btn--primary',
      icon('walk') + '<span>Walk this floor</span>');
    walkBtn.addEventListener('click', function () {
      openWalk(floor === 'first' ? 'family-lounge'
        : floor === 'site' ? 'main-gate' : 'foyer');
    });
    tools.appendChild(walkBtn);

    wrap.appendChild(tools);

    var boxEl = e('div', 'planbox');
    var built = window.Plan.build(floor, {
      zones: app.planZones,
      onPick: function (id) { selectOnPlan(id); }
    });
    boxEl.appendChild(built.svg);
    boxEl.appendChild(e('div', 'plan-zoomhint',
      'Tap a room for details · drag to pan · pinch or Ctrl + scroll to zoom'));
    wrap.appendChild(boxEl);

    app.shapes = built.shapes;
    app.pz = window.Plan.enablePanZoom(built.svg, built.root);
    zin.addEventListener('click', app.pz.zoomIn);
    zout.addEventListener('click', app.pz.zoomOut);
    zres.addEventListener('click', app.pz.reset);

    /* legend */
    var legend = e('div', 'legend');
    if (app.planZones) {
      V.zones.forEach(function (z) {
        legend.appendChild(e('span', null,
          '<i style="background:' + z.color + '"></i>' + esc(z.name)));
      });
    } else {
      [['room', 'Rooms'], ['circ', 'Circulation'], ['open', 'Open to sky'],
        ['water', 'Water'], ['land', 'Planting'], ['paving', 'Hard landscape']
      ].forEach(function (k) {
        legend.appendChild(e('span', null,
          '<i style="background:var(--plan-' + k[0] + ')"></i>' + k[1]));
      });
    }
    wrap.appendChild(legend);

    /* the rooms on this floor, as cards */
    var onFloor = V.rooms.filter(function (r) {
      return floor === 'site' ? r.floor === 'site' : r.floor === floor;
    });
    wrap.appendChild(e('div', 'section-head',
      '<h2 style="font-size:24px">Spaces on this ' +
      (floor === 'site' ? 'site' : 'floor') + '</h2>' +
      '<p>' + onFloor.length + ' spaces. Select any one for its dimensions, ' +
      'purpose, features and connections.</p>'));

    var cards = e('div', 'cards');
    onFloor.forEach(function (r) { cards.appendChild(X.roomCard(r, openRoom)); });
    wrap.appendChild(cards);

    if (s.images && s.images.length) {
      wrap.appendChild(e('div', 'section-head',
        '<h2 style="font-size:24px">Concept sheets</h2>' +
        '<p>The original presentation drawings this plan was developed from.</p>'));
      wrap.appendChild(X.galleryOf(s.images));
    }

    if (opts && opts.room) selectOnPlan(opts.room);
  }

  function selectOnPlan(id) {
    Object.keys(app.shapes).forEach(function (k) {
      app.shapes[k].removeAttribute('data-active');
    });
    if (app.shapes[id]) app.shapes[id].setAttribute('data-active', 'true');
    var r = V.byId(id);
    if (r && app.pz) app.pz.focus(r);
    X.showRoom(id);
  }

  /* ---- room-list sections ---- */

  function renderRooms(wrap, s) {
    var cards = e('div', 'cards');
    s.rooms.forEach(function (id) {
      var r = V.byId(id);
      if (r) cards.appendChild(X.roomCard(r, openRoom));
    });
    wrap.appendChild(cards);

    /* every render belonging to these rooms, de-duplicated */
    var ids = [];
    s.rooms.forEach(function (id) {
      var r = V.byId(id);
      if (!r) return;
      (r.images || []).forEach(function (im) {
        if (ids.indexOf(im) < 0) ids.push(im);
      });
    });
    if (ids.length) {
      wrap.appendChild(e('div', 'section-head',
        '<h2 style="font-size:24px">Gallery</h2>'));
      wrap.appendChild(X.galleryOf(ids));
    }

    var acts = e('div', 'panel__actions');
    var w = e('button', 'btn btn--primary',
      icon('walk') + '<span>Walk to ' + esc(V.byId(s.rooms[0]).name) + '</span>');
    w.addEventListener('click', function () { openWalk(s.rooms[0]); });
    acts.appendChild(w);
    wrap.appendChild(acts);
  }

  function footer() {
    var f = e('div', 'footer');
    f.appendChild(e('div', 'footer__tag', esc(V.meta.tagline)));
    f.appendChild(e('p', null, esc(V.meta.disclaimer)));
    return f;
  }

  /* ------------------------------------------------------------- actions */

  function openRoom(id) {
    X.showRoom(id);
    var r = V.byId(id);
    if (r && app.shapes[id]) {
      Object.keys(app.shapes).forEach(function (k) {
        app.shapes[k].removeAttribute('data-active');
      });
      app.shapes[id].setAttribute('data-active', 'true');
    }
  }

  function openWalk(roomId) {
    if (!window.Walk) return;
    window.Walk.open(roomId);
  }

  /* ---------------------------------------------------------------- init */

  function init() {
    dom.main = document.getElementById('main');
    dom.nav = document.getElementById('nav');
    dom.drawer = document.getElementById('navdrawer');
    dom.scrim = document.getElementById('scrim');
    dom.themeBtn = document.getElementById('themeBtn');

    /* touch capability decides the walkthrough control scheme */
    var touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    document.body.setAttribute('data-touch', String(touch));

    var saved = 'day';
    try { saved = localStorage.getItem('haven-theme') || 'day'; } catch (err) { /* ok */ }
    setTheme(saved);

    dom.themeBtn.addEventListener('click', function () {
      setTheme(app.theme === 'night' ? 'day' : 'night');
    });

    document.getElementById('menuBtn').addEventListener('click', function () {
      setDrawer(dom.drawer.getAttribute('data-open') !== 'true');
    });
    dom.scrim.addEventListener('click', function () { setDrawer(false); });

    document.getElementById('brand').addEventListener('click', function () {
      go('home');
    });
    document.getElementById('walkTop').addEventListener('click', function () {
      openWalk(null);
    });

    buildNav(dom.nav, false);
    buildNav(document.getElementById('drawerNav'), true);

    X.initLightbox(document.getElementById('lightbox'));

    X.panel.root = document.getElementById('panel');
    X.panel.onWalk = function (id) { X.hideRoom(); openWalk(id); };
    X.panel.onSelect = function (id, floor) {
      go(floor === 'site' ? 'site' : floor, { room: id });
    };

    /* guided tour */
    window.Tour.init({
      dom: {
        root: document.getElementById('tour'),
        stage: document.getElementById('tourStage'),
        dots: document.getElementById('tourDots'),
        title: document.getElementById('tourTitle'),
        caption: document.getElementById('tourCaption'),
        routeName: document.getElementById('tourRoute'),
        step: document.getElementById('tourStep'),
        map: document.getElementById('tourMap'),
        next: document.getElementById('tourNext'),
        prev: document.getElementById('tourPrev'),
        play: document.getElementById('tourPlay'),
        close: document.getElementById('tourClose'),
        walkHere: document.getElementById('tourWalk')
      },
      onWalk: function (id) { openWalk(id); }
    });

    /* 3D walkthrough */
    window.Walk.init({
      dom: {
        root: document.getElementById('walk'),
        canvasHost: document.getElementById('walkCanvas'),
        minimap: document.getElementById('walkMap'),
        roomName: document.getElementById('walkRoom'),
        floorName: document.getElementById('walkFloor'),
        floorBtn: document.getElementById('walkFloorBtn'),
        hint: document.getElementById('walkHint'),
        loading: document.getElementById('walkLoading'),
        fallback: document.getElementById('walkFallback'),
        stick: document.getElementById('stick'),
        knob: document.getElementById('stickKnob')
      },
      onRoomPick: function (id) { X.showRoom(id); }
    });

    document.getElementById('walkClose').addEventListener('click', function () {
      window.Walk.close();
    });
    document.getElementById('walkFloorBtn').addEventListener('click', function () {
      window.Walk.setFloor(window.Walk.currentFloor() === 'ground' ? 'first' : 'ground');
    });

    var tpBtn = document.getElementById('walkTeleportBtn');
    var tp = document.getElementById('walkTeleport');
    tpBtn.addEventListener('click', function () {
      tp.setAttribute('data-open', tp.getAttribute('data-open') !== 'true');
    });
    buildTeleport(tp);

    document.getElementById('walkTourBtn').addEventListener('click', function () {
      window.Walk.close();
      window.Tour.open('arrival');
    });

    window.addEventListener('hashchange', function () {
      var id = location.hash.replace('#', '') || 'home';
      if (id !== app.section) go(id);
    });

    go(location.hash.replace('#', '') || 'home');
  }

  function buildTeleport(host) {
    host.innerHTML = '';
    [['Ground floor', 'ground'], ['First floor', 'first'], ['Outside', 'site']]
      .forEach(function (g) {
        host.appendChild(e('div', 'nav__title', g[0]));
        V.rooms.filter(function (r) { return r.floor === g[1]; })
          .forEach(function (r) {
            var b = e('button', null, esc(r.name));
            b.type = 'button';
            b.addEventListener('click', function () {
              window.Walk.teleport(r.id);
              host.setAttribute('data-open', 'false');
            });
            host.appendChild(b);
          });
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
