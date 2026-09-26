/* ==========================================================================
   Section rendering, room panels, galleries and the lightbox.
   Everything on screen is generated from VILLA, so adding a room to the data
   adds it to the plans, the cards and the navigation at the same time.
   ========================================================================== */

(function () {
  'use strict';

  var V = window.VILLA;

  /* ---------------------------------------------------------------- icons */

  var ICONS = {
    home: 'M3 11.2 12 4l9 7.2M5.6 9.6V20h12.8V9.6',
    map: 'M9 4 3 6.6v13.2L9 17.2l6 2.6 6-2.6V4l-6 2.6zM9 4v13.2M15 6.6V20',
    plan: 'M3.4 3.4h17.2v17.2H3.4zM3.4 10.4h10M13.4 10.4v10.2M13.4 3.4v3.6',
    tree: 'M12 21v-5m0 0 4.6-3.4H7.4zm0-3.4L16 10H8zM12 10l3.4-2.8H8.6z',
    sofa: 'M4 11V8.4A2 2 0 0 1 6 6.4h12a2 2 0 0 1 2 2V11M3 11.6h18v5.2H3zM6 16.8V19M18 16.8V19',
    kitchen: 'M4 3.6h16v16.8H4zM4 9.2h16M8 5.6v2M12 12.4v5.2M9 12.4h6',
    bed: 'M3 19v-7.4h18V19M3 11.6V6M21 11.6V9.4a2 2 0 0 0-2-2h-6v4.2M3 16h18',
    star: 'M12 3.6 14.4 9l5.6.6-4.2 3.9 1.2 5.6L12 16.4 7 19.1l1.2-5.6L4 9.6 9.6 9z',
    film: 'M3.4 4.8h17.2v14.4H3.4zM8 4.8v14.4M16 4.8v14.4M3.4 12h17.2',
    dumbbell: 'M6.4 9v6M4 10.2v3.6M17.6 9v6M20 10.2v3.6M6.4 12h11.2',
    globe: 'M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2zM3.4 12h17.2M12 3.4c2.4 2.6 3.4 5.6 3.4 8.6s-1 6-3.4 8.6c-2.4-2.6-3.4-5.6-3.4-8.6s1-6 3.4-8.6z',
    wave: 'M3 9.2c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 5.8-.6M3 15c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 4.4-2 5.8-.6',
    leaf: 'M5 19c0-8 5.4-13.4 14-13.4C19 14.2 13.6 19.6 5 19.6zM5 19.6 11.4 13',
    chair: 'M6 4.6h12v8.8H6zM7.4 13.4 6 20M16.6 13.4 18 20M5 13.4h14',
    drop: 'M12 3.4c3.4 4.2 5.2 7 5.2 9.4a5.2 5.2 0 0 1-10.4 0c0-2.4 1.8-5.2 5.2-9.4z',
    building: 'M4 20.4V6.6L12 3l8 3.6v13.8M4 20.4h16M9 20.4v-5h6v5M8 9.4h2M14 9.4h2M8 12.6h2M14 12.6h2',
    walk: 'M13.4 4.2a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0zM11 8l-3 3.4 1.8 2.2L8 20M11 8l3.2 1.4L16 14M9.8 13.6 13 12.6',
    play: 'M8 5.2v13.6L19 12z',
    close: 'M6 6l12 12M18 6 6 18',
    menu: 'M4 7h16M4 12h16M4 17h16',
    sun: 'M12 7.4A4.6 4.6 0 1 0 12 16.6 4.6 4.6 0 0 0 12 7.4zM12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6',
    moon: 'M20 14.4A8.4 8.4 0 0 1 9.6 4 8.6 8.6 0 1 0 20 14.4z',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    reset: 'M4.6 9.4a7.6 7.6 0 1 1-.6 4M4.6 4.4v5h5',
    pin: 'M12 21s6.4-6.2 6.4-10.4a6.4 6.4 0 1 0-12.8 0C5.6 14.8 12 21 12 21zM12 8.4a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z',
    left: 'M15 5 8 12l7 7',
    right: 'M9 5l7 7-7 7',
    layers: 'M12 3.4 3 8l9 4.6L21 8zM3 13l9 4.6L21 13M3 17.4 12 22l9-4.6'
  };

  function icon(name, cls) {
    var d = ICONS[name] || ICONS.home;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ' +
      (cls ? 'class="' + cls + '" ' : '') + 'aria-hidden="true"><path d="' + d + '"/></svg>';
  }

  /* --------------------------------------------------------------- utils */

  function e(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function img(id, alt, thumb) {
    var n = document.createElement('img');
    n.src = 'assets/renders/' + id + (thumb ? '-thumb' : '') + '.jpg';
    n.alt = alt || '';
    n.loading = 'lazy';
    n.decoding = 'async';
    return n;
  }

  function zoneOf(room) {
    var z = null;
    V.zones.forEach(function (o) { if (o.id === room.zone) z = o; });
    return z;
  }

  /* Human caption for a render id, used in galleries and the lightbox. */
  var CAPTIONS = {
    'aerial-view': 'Aerial view from the north road',
    'courtyard': 'Central courtyard, open to sky',
    'courtyard-alt': 'Courtyard from the verandah',
    'pool-rear': 'Rear swimming pool and deck',
    'pool-main': 'Main pool, evening',
    'elevation-front': 'Front elevation from the north road',
    'elevation-dusk': 'Front elevation at dusk',
    'hero-title': 'The approach at dusk',
    'master-suite': 'Master suite',
    'master-suite-wide': 'Master bedroom and lounge',
    'master-pool': 'Master private plunge pool and garden',
    'outdoor-shower': 'Master outdoor shower',
    'home-theatre': 'Home theatre, eight seats',
    'home-theatre-alt': 'Home theatre from the rear row',
    'gym': 'Gym, looking into the garden',
    'gym-alt': 'Gym and workout area',
    'travel-room': 'Travel memory room',
    'travel-room-alt': 'Travel room, map wall',
    'outdoor-seating': 'Evening seating garden',
    'outdoor-seating-alt': 'Outdoor seating area',
    'fruit-garden': 'Fruit garden',
    'fruit-garden-alt': 'Orchard planting',
    'pavilion': 'Relaxation pavilion',
    'pavilion-alt': 'Garden pavilion',
    'pavilion-wide': 'Pavilion and outdoor lounge',
    'well': 'The well, outside the house',
    'well-alt': 'Well and planted surround',
    'living': 'Living room',
    'dining': 'Dining area',
    'kitchen': 'Main kitchen',
    'guest-bedroom': 'Bedroom',
    'site-plan': 'Master site plan',
    'ground-plan-render': 'Ground floor, concept render',
    'ground-plan-alt': 'Ground floor, alternative study',
    'first-plan-render': 'First floor, concept render',
    'materials': 'Interior materials and style'
  };

  function captionFor(id) { return CAPTIONS[id] || id.replace(/-/g, ' '); }

  /* ------------------------------------------------------------ lightbox */

  var lb = { list: [], i: 0, root: null, img: null, cap: null };

  function openLightbox(ids, start) {
    lb.list = ids;
    lb.i = start || 0;
    render();
    lb.root.setAttribute('data-open', 'true');
    document.body.style.overflow = 'hidden';
  }

  function render() {
    var id = lb.list[lb.i];
    lb.img.src = 'assets/renders/' + id + '.jpg';
    lb.img.alt = captionFor(id);
    lb.cap.textContent = captionFor(id) +
      (lb.list.length > 1 ? '   ·   ' + (lb.i + 1) + ' / ' + lb.list.length : '');
  }

  function closeLightbox() {
    lb.root.setAttribute('data-open', 'false');
    document.body.style.overflow = '';
  }

  function step(d) {
    lb.i = (lb.i + d + lb.list.length) % lb.list.length;
    render();
  }

  function initLightbox(root) {
    lb.root = root;
    lb.img = root.querySelector('img');
    lb.cap = root.querySelector('.lightbox__cap');
    root.querySelector('.lightbox__close').addEventListener('click', closeLightbox);
    root.querySelector('.lightbox__nav--prev').addEventListener('click', function (ev) {
      ev.stopPropagation(); step(-1);
    });
    root.querySelector('.lightbox__nav--next').addEventListener('click', function (ev) {
      ev.stopPropagation(); step(1);
    });
    root.addEventListener('click', function (ev) {
      if (ev.target === root) closeLightbox();
    });
    document.addEventListener('keydown', function (ev) {
      if (root.getAttribute('data-open') !== 'true') return;
      if (ev.key === 'Escape') closeLightbox();
      if (ev.key === 'ArrowRight') step(1);
      if (ev.key === 'ArrowLeft') step(-1);
    });
  }

  /* --------------------------------------------------------- room panel */

  var panel = { root: null, onWalk: null, onSelect: null, current: null };

  function showRoom(id) {
    var r = V.byId(id);
    if (!r) return;
    panel.current = id;

    var z = zoneOf(r);
    var head = panel.root.querySelector('.panel__head');
    head.innerHTML =
      '<div style="flex:1;min-width:0">' +
        '<h3>' + esc(r.name) + '</h3>' +
        '<div class="card__meta">' +
          (z ? '<span class="zonedot" style="background:' + z.color + '"></span>' +
            esc(z.name.replace(/^Zone \d+ — /, '')) : '') +
          '<span>·</span><span>' + V.dimsOf(r) + '</span>' +
          '<span>·</span><span>' + V.areaOf(r).toLocaleString() + ' sq ft</span>' +
        '</div>' +
      '</div>';
    var x = e('button', 'iconbtn', icon('close'));
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', hideRoom);
    head.appendChild(x);

    var body = panel.root.querySelector('.panel__body');
    body.innerHTML = '';

    /* gallery, or a plan close-up when no render exists for this space */
    if (!r.images || !r.images.length) {
      body.appendChild(e('h4', null, 'No render yet'));
      var vg = e('div', 'minimap-wrap');
      vg.appendChild(window.Plan.vignette(r));
      body.appendChild(vg);
      body.appendChild(e('p', 'panel__note',
        'The concept sheets do not include a render of this space. ' +
        'It is listed in readme.md §19 as an image still to be produced.'));
    }
    if (r.images && r.images.length) {
      body.appendChild(e('h4', null, 'Gallery'));
      var gal = e('div', 'panel__gallery');
      r.images.forEach(function (im, k) {
        var n = img(im, captionFor(im), true);
        n.addEventListener('click', function () { openLightbox(r.images, k); });
        gal.appendChild(n);
      });
      body.appendChild(gal);
    }

    body.appendChild(e('h4', null, 'Purpose'));
    body.appendChild(e('p', null, esc(r.purpose)));

    if (r.features && r.features.length) {
      body.appendChild(e('h4', null, 'Key design features'));
      var ul = e('ul', 'featlist');
      r.features.forEach(function (f) { ul.appendChild(e('li', null, esc(f))); });
      body.appendChild(ul);
    }

    /* location on the plan */
    body.appendChild(e('h4', null, 'Where it sits'));
    var mapWrap = e('div', 'minimap-wrap');
    var floor = r.floor === 'first' ? 'first' : 'ground';
    var mm = window.Plan.minimap(floor);
    mm.svg.style.maxHeight = '260px';
    var c = V.centre(r);
    mm.move(c[0], c[1], 0);
    mapWrap.appendChild(mm.svg);
    body.appendChild(mapWrap);
    body.appendChild(e('p', null,
      '<span style="font-size:13px;color:var(--muted)">' +
      (r.floor === 'site' ? 'On the site, outside the house'
        : r.floor === 'first' ? 'First floor' : 'Ground floor') +
      '</span>'));

    if (r.connects && r.connects.length) {
      body.appendChild(e('h4', null, 'Connected spaces'));
      var chips = e('div', 'chips');
      r.connects.forEach(function (cid) {
        var o = V.byId(cid);
        if (!o) return;
        var b = e('button', 'chip', esc(o.name));
        b.addEventListener('click', function () { showRoom(cid); });
        chips.appendChild(b);
      });
      body.appendChild(chips);
    }

    if (r.note) body.appendChild(e('p', 'panel__note', esc(r.note)));

    var acts = e('div', 'panel__actions');
    var walk = e('button', 'btn btn--primary', icon('walk') +
      '<span>Walk here in 3D</span>');
    walk.addEventListener('click', function () {
      if (panel.onWalk) panel.onWalk(r.id);
    });
    acts.appendChild(walk);

    if (r.floor !== 'site') {
      var plan = e('button', 'btn', icon('plan') + '<span>Show on plan</span>');
      plan.addEventListener('click', function () {
        if (panel.onSelect) panel.onSelect(r.id, r.floor);
      });
      acts.appendChild(plan);
    }
    body.appendChild(acts);

    body.scrollTop = 0;
    panel.root.setAttribute('data-open', 'true');
  }

  function hideRoom() {
    panel.root.setAttribute('data-open', 'false');
    panel.current = null;
    document.querySelectorAll('.room-shape[data-active="true"]').forEach(
      function (n) { n.removeAttribute('data-active'); });
  }

  /* -------------------------------------------------------- section views */

  function roomCard(r, onPick) {
    var card = e('button', 'card');
    card.type = 'button';
    var media = e('div', 'card__media');
    if (r.images && r.images.length) {
      media.appendChild(img(r.images[0], r.name, true));
    } else {
      /* no photograph exists for this space, so show where it sits instead */
      media.className = 'card__media card__media--plan';
      media.appendChild(window.Plan.vignette(r));
    }
    card.appendChild(media);

    var z = zoneOf(r);
    var body = e('div', 'card__body');
    body.appendChild(e('div', 'card__name', esc(r.name)));
    body.appendChild(e('div', 'card__meta',
      (z ? '<span class="zonedot" style="background:' + z.color + '"></span>' : '') +
      V.dimsOf(r) + ' · ' + V.areaOf(r).toLocaleString() + ' sq ft'));
    card.appendChild(body);
    card.addEventListener('click', function () { onPick(r.id); });
    return card;
  }

  function sectionHead(s) {
    var h = e('div', 'section-head');
    h.appendChild(e('div', 'section-head__eyebrow', 'The Tropical Haven'));
    h.appendChild(e('h2', null, esc(s.label)));
    if (s.blurb) h.appendChild(e('p', null, esc(s.blurb)));
    return h;
  }

  function galleryOf(ids) {
    var g = e('div', 'gallery');
    ids.forEach(function (id, k) {
      var fig = document.createElement('figure');
      fig.appendChild(img(id, captionFor(id), true));
      var cap = document.createElement('figcaption');
      cap.textContent = captionFor(id);
      fig.appendChild(cap);
      fig.addEventListener('click', function () { openLightbox(ids, k); });
      g.appendChild(fig);
    });
    return g;
  }

  window.Explorer = {
    icon: icon,
    el: e,
    esc: esc,
    img: img,
    captionFor: captionFor,
    zoneOf: zoneOf,
    roomCard: roomCard,
    sectionHead: sectionHead,
    galleryOf: galleryOf,
    openLightbox: openLightbox,
    initLightbox: initLightbox,
    showRoom: showRoom,
    hideRoom: hideRoom,
    panel: panel
  };
})();
