/* ==========================================================================
   Cinematic guided tour.
   Walks one of the circulation routes from readme.md section 15 as a
   full-screen sequence of the real renders, with a marker tracking the
   position on the floor plan.
   ========================================================================== */

(function () {
  'use strict';

  var V = window.VILLA;
  var dom = {};
  var route = null;
  var steps = [];
  var index = 0;
  var timer = null;
  var playing = true;
  var mini = null;
  var miniFloor = null;
  var STEP_MS = 8200;

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Find the best image for a step: the room's own render, otherwise one from
     a space it connects to, otherwise the aerial view. */
  function imageFor(room) {
    if (room.images && room.images.length) return room.images[0];
    var found = null;
    (room.connects || []).some(function (id) {
      var r = V.byId(id);
      if (r && r.images && r.images.length) { found = r.images[0]; return true; }
      return false;
    });
    return found || 'aerial-view';
  }

  function build(routeId) {
    route = null;
    V.routes.forEach(function (r) { if (r.id === routeId) route = r; });
    if (!route) route = V.routes[0];

    steps = route.steps.map(function (id) {
      var r = V.byId(id);
      return { room: r, image: imageFor(r) };
    }).filter(function (s) { return !!s.room; });

    dom.routeName.textContent = route.name;
    dom.stage.innerHTML = '';
    dom.dots.innerHTML = '';

    steps.forEach(function (s, i) {
      var slide = document.createElement('div');
      slide.className = 'tour__slide';
      var img = document.createElement('img');
      img.src = 'assets/renders/' + s.image + '.jpg';
      img.alt = s.room.name;
      /* only the first frame is eager; the rest load as the tour advances */
      img.loading = i === 0 ? 'eager' : 'lazy';
      slide.appendChild(img);
      dom.stage.appendChild(slide);
      s.el = slide;

      var dot = document.createElement('button');
      dot.className = 'tour__dot';
      dot.type = 'button';
      dot.setAttribute('aria-label', 'Go to ' + s.room.name);
      dot.addEventListener('click', function () { go(i); });
      dom.dots.appendChild(dot);
      s.dot = dot;
    });

    index = 0;
    show(0);
  }

  function show(i) {
    if (!steps.length) return;
    index = (i + steps.length) % steps.length;
    var s = steps[index];

    steps.forEach(function (o, k) {
      o.el.setAttribute('data-on', k === index ? 'true' : 'false');
      o.dot.setAttribute('aria-current', k === index ? 'true' : 'false');
    });

    dom.title.textContent = s.room.name;
    dom.caption.textContent = s.room.purpose;
    dom.step.textContent = (index + 1) + ' / ' + steps.length;

    /* keep the minimap on the right storey */
    var floor = s.room.floor === 'first' ? 'first' : 'ground';
    if (floor !== miniFloor) {
      miniFloor = floor;
      mini = window.Plan.minimap(floor);
      dom.map.innerHTML = '';
      dom.map.appendChild(mini.svg);
    }
    var c = V.centre(s.room);
    /* face the next stop, so the view cone points along the route */
    var next = steps[(index + 1) % steps.length];
    var nc = V.centre(next.room);
    var heading = (next === s) ? 0 :
      Math.atan2(-(nc[0] - c[0]), -(nc[1] - c[1]));
    mini.move(c[0], c[1], heading);

    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    if (playing && steps.length > 1) {
      timer = setTimeout(function () { go(index + 1); }, STEP_MS);
    }
  }

  function go(i) { show(i); }

  function setPlaying(on) {
    playing = on;
    dom.play.setAttribute('aria-pressed', String(on));
    dom.play.innerHTML = on ? icon('pause') : icon('play');
    if (on) schedule(); else clearTimeout(timer);
  }

  function icon(name) {
    if (name === 'pause') {
      return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<rect x="6" y="5" width="4" height="14" rx="1"/>' +
        '<rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M8 5.2v13.6L19 12z"/></svg>';
  }

  function open(routeId) {
    build(routeId);
    dom.root.setAttribute('data-open', 'true');
    document.body.style.overflow = 'hidden';
    setPlaying(!reduceMotion);
  }

  function close() {
    dom.root.setAttribute('data-open', 'false');
    document.body.style.overflow = '';
    clearTimeout(timer);
  }

  function init(options) {
    dom = options.dom;

    dom.next.addEventListener('click', function () { go(index + 1); });
    dom.prev.addEventListener('click', function () { go(index - 1); });
    dom.play.addEventListener('click', function () { setPlaying(!playing); });
    dom.close.addEventListener('click', close);
    dom.walkHere.addEventListener('click', function () {
      var id = steps[index] && steps[index].room.id;
      close();
      if (options.onWalk) options.onWalk(id);
    });

    document.addEventListener('keydown', function (e) {
      if (dom.root.getAttribute('data-open') !== 'true') return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
      if (e.key === ' ') { e.preventDefault(); setPlaying(!playing); }
    });

    /* swipe between stops on touch */
    var sx = null;
    dom.stage.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    dom.stage.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx;
      if (Math.abs(dx) > 55) go(index + (dx < 0 ? 1 : -1));
      sx = null;
    });
  }

  window.Tour = { init: init, open: open, close: close };
})();
