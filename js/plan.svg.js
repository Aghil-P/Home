/* ==========================================================================
   Interactive floor plans, drawn as vector SVG from VILLA.rooms.
   Nothing here is hand-drawn: every shape, label and area comes from the
   room rectangles, so the plan always agrees with the 3D model and the
   room panels.
   ========================================================================== */

(function () {
  'use strict';

  var V = window.VILLA;
  var NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) {
      if (attrs[k] !== null && attrs[k] !== undefined) {
        n.setAttribute(k, attrs[k]);
      }
    }
    return n;
  }

  /* Rooms drawn behind others so their labels stay legible. */
  var DRAW_ORDER = ['landscape', 'paving', 'water', 'open', 'structure',
    'circulation', 'room'];

  function sortForDraw(rooms) {
    return rooms.slice().sort(function (a, b) {
      return DRAW_ORDER.indexOf(a.kind) - DRAW_ORDER.indexOf(b.kind);
    });
  }

  /* -------------------------------------------------------------- build --
     floor: 'ground' | 'first' | 'site'
     opts:  { zones: bool, labels: bool, onPick: fn(roomId), interactive: bool }
  ---------------------------------------------------------------------- */
  function build(floor, opts) {
    opts = opts || {};
    var showZones = !!opts.zones;
    var interactive = opts.interactive !== false;

    var rooms, vb;
    if (floor === 'site') {
      rooms = V.rooms.slice();
      vb = [-4, -4, V.plot.w + 8, V.plot.d + 8];
    } else {
      /* Floor plans show the storey plus the landscape it opens onto, so the
         plan reads as a house in a garden rather than a floating box. */
      rooms = V.rooms.filter(function (r) {
        return r.floor === floor || r.floor === 'site';
      });
      vb = [-4, -4, V.plot.w + 8, V.plot.d + 8];
    }

    var svg = el('svg', {
      viewBox: vb.join(' '),
      xmlns: NS,
      role: 'img',
      'aria-label': floor + ' plan'
    });

    var root = el('g', { 'data-root': '1' });
    svg.appendChild(root);

    /* plot boundary */
    root.appendChild(el('rect', {
      x: 0, y: 0, width: V.plot.w, height: V.plot.d,
      fill: 'none', stroke: 'var(--line)', 'stroke-width': 0.5,
      'stroke-dasharray': '2 1.5', 'vector-effect': 'non-scaling-stroke'
    }));

    /* the north road */
    root.appendChild(el('rect', {
      x: -4, y: -4, width: V.plot.w + 8, height: 4,
      fill: 'var(--plan-paving)', opacity: 0.85
    }));
    var road = el('text', {
      x: V.plot.w / 2, y: -1.3, 'text-anchor': 'middle',
      'font-size': 1.7, fill: 'var(--plan-label)',
      'letter-spacing': 0.5, opacity: 0.75
    });
    road.textContent = 'NORTH FACING ROAD';
    root.appendChild(road);

    var shapes = {};

    sortForDraw(rooms).forEach(function (r) {
      var isFloorRoom = r.floor === floor;
      var dim = floor !== 'site' && !isFloorRoom;

      var g = el('g', { 'data-room': r.id });

      var fill = showZones && isFloorRoom
        ? 'var(--zone-' + r.zone + ')'
        : 'var(--plan-' + shortKind(r.kind) + ')';

      var shape = el('rect', {
        x: r.rect[0], y: r.rect[1], width: r.rect[2], height: r.rect[3],
        rx: r.kind === 'water' ? 1 : 0.4,
        fill: fill,
        'fill-opacity': showZones && isFloorRoom ? 0.55 : (dim ? 0.45 : 1),
        stroke: 'var(--plan-wall)',
        'stroke-width': wallWeight(r, floor),
        'stroke-opacity': dim ? 0.25 : (isStructural(r) ? 0.85 : 0.35),
        'vector-effect': 'non-scaling-stroke',
        'class': interactive && isFloorRoom ? 'room-shape' : null
      });
      g.appendChild(shape);
      if (isFloorRoom) shapes[r.id] = shape;

      /* water gets a soft inner line, planting a dotted texture */
      if (r.kind === 'water') {
        g.appendChild(el('rect', {
          x: r.rect[0] + 0.8, y: r.rect[1] + 0.8,
          width: Math.max(0, r.rect[2] - 1.6), height: Math.max(0, r.rect[3] - 1.6),
          rx: 0.8, fill: 'none', stroke: 'var(--plan-wall)',
          'stroke-width': 0.6, 'stroke-opacity': 0.18,
          'vector-effect': 'non-scaling-stroke'
        }));
      }

      if (!dim && opts.labels !== false) {
        addLabel(g, r, floor);
      }

      /* a generous transparent hit area keeps small rooms tappable */
      if (interactive && isFloorRoom) {
        var hit = el('rect', {
          x: r.rect[0], y: r.rect[1], width: r.rect[2], height: r.rect[3],
          'class': 'room-hit', tabindex: 0, role: 'button',
          'aria-label': r.name + ', ' + V.dimsOf(r)
        });
        hit.addEventListener('click', function (e) {
          e.stopPropagation();
          if (opts.onPick) opts.onPick(r.id);
        });
        hit.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (opts.onPick) opts.onPick(r.id);
          }
        });
        g.appendChild(hit);
      }

      root.appendChild(g);
    });

    if (floor !== 'site') {
      /* the courtyard void is hatched on the first floor so it reads as open */
      var void_ = rooms.filter(function (r) {
        return r.floor === floor && r.kind === 'open' && r.id.indexOf('courtyard') === 0;
      });
      void_.forEach(function (r) { root.appendChild(hatch(r)); });
    }

    root.appendChild(northArrow(V.plot.w - 5, 6));
    root.appendChild(scaleBar(4, V.plot.d + 1.5));

    return { svg: svg, root: root, shapes: shapes };
  }

  function shortKind(kind) {
    if (kind === 'circulation') return 'circ';
    if (kind === 'landscape') return 'land';
    if (kind === 'structure') return 'paving';
    return kind;
  }

  function isStructural(r) {
    return r.kind === 'room' || r.kind === 'circulation';
  }

  function wallWeight(r, floor) {
    if (r.floor !== floor) return 0.6;
    return isStructural(r) ? 1.6 : 0.8;
  }

  function hatch(r) {
    var g = el('g', { opacity: 0.35 });
    for (var i = 0; i < r.rect[2] + r.rect[3]; i += 3) {
      var x1 = r.rect[0] + i, y1 = r.rect[1];
      var x2 = r.rect[0], y2 = r.rect[1] + i;
      if (x1 > r.rect[0] + r.rect[2]) {
        y1 += x1 - (r.rect[0] + r.rect[2]);
        x1 = r.rect[0] + r.rect[2];
      }
      if (y2 > r.rect[1] + r.rect[3]) {
        x2 += y2 - (r.rect[1] + r.rect[3]);
        y2 = r.rect[1] + r.rect[3];
      }
      if (y1 > r.rect[1] + r.rect[3] || x2 > r.rect[0] + r.rect[2]) continue;
      g.appendChild(el('line', {
        x1: x1, y1: y1, x2: x2, y2: y2,
        stroke: 'var(--plan-wall)', 'stroke-width': 0.3,
        'stroke-opacity': 0.5, 'vector-effect': 'non-scaling-stroke'
      }));
    }
    return g;
  }

  function addLabel(g, r, floor) {
    var c = V.centre(r);
    var area = V.areaOf(r);
    var small = r.rect[2] < 9 || r.rect[3] < 7;
    var tiny = r.rect[2] < 6.5 || r.rect[3] < 5.5;
    if (tiny && floor === 'site') return;

    var size = small ? 1.35 : 1.85;
    var name = el('text', {
      x: c[0], y: c[1] - (small ? 0 : 0.5),
      'text-anchor': 'middle',
      'font-size': size,
      'font-family': 'Georgia, serif',
      fill: 'var(--plan-label)',
      'pointer-events': 'none'
    });

    /* wrap long names inside narrow rooms */
    var words = r.name.split(' ');
    if (!small && words.length > 2 && r.rect[2] < 18) {
      var mid = Math.ceil(words.length / 2);
      line(name, words.slice(0, mid).join(' '), c[0], 0);
      line(name, words.slice(mid).join(' '), c[0], size * 0.95);
      name.setAttribute('y', c[1] - size * 0.55);
    } else {
      name.textContent = small ? shorten(r.name) : r.name;
    }
    g.appendChild(name);

    if (!small) {
      var sub = el('text', {
        x: c[0], y: c[1] + (words.length > 2 && r.rect[2] < 18 ? size * 1.7 : 1.7),
        'text-anchor': 'middle', 'font-size': 1.25,
        fill: 'var(--plan-label)', opacity: 0.68, 'pointer-events': 'none'
      });
      sub.textContent = V.dimsOf(r) + '  ·  ' + area.toLocaleString() + ' sq ft';
      g.appendChild(sub);
    }
  }

  function line(text, str, x, dy) {
    var t = el('tspan', { x: x, dy: dy });
    t.textContent = str;
    text.appendChild(t);
  }

  function shorten(name) {
    return name
      .replace('Bedroom ', 'Bed ')
      .replace(' Bathroom', ' Bath')
      .replace('Laundry / Utility', 'Utility')
      .replace('Upper ', '')
      .replace(' Room', '');
  }

  function northArrow(x, y) {
    var g = el('g', { transform: 'translate(' + x + ',' + y + ')', opacity: 0.8 });
    g.appendChild(el('circle', {
      cx: 0, cy: 0, r: 3.2, fill: 'var(--surface)',
      stroke: 'var(--plan-wall)', 'stroke-width': 0.8,
      'stroke-opacity': 0.5, 'vector-effect': 'non-scaling-stroke'
    }));
    g.appendChild(el('path', {
      d: 'M0,-2.4 L1.25,1.3 L0,0.45 L-1.25,1.3 Z',
      fill: 'var(--plan-wall)'
    }));
    var t = el('text', {
      x: 0, y: 2.9, 'text-anchor': 'middle', 'font-size': 1.5,
      fill: 'var(--plan-label)', 'font-family': 'Georgia, serif'
    });
    t.textContent = 'N';
    g.appendChild(t);
    return g;
  }

  function scaleBar(x, y) {
    var g = el('g', { opacity: 0.75 });
    var len = 20; // feet
    g.appendChild(el('line', {
      x1: x, y1: y, x2: x + len, y2: y,
      stroke: 'var(--plan-wall)', 'stroke-width': 1.2,
      'vector-effect': 'non-scaling-stroke'
    }));
    [0, len / 2, len].forEach(function (t) {
      g.appendChild(el('line', {
        x1: x + t, y1: y - 0.7, x2: x + t, y2: y + 0.7,
        stroke: 'var(--plan-wall)', 'stroke-width': 1.2,
        'vector-effect': 'non-scaling-stroke'
      }));
    });
    var lab = el('text', {
      x: x + len + 1.5, y: y + 0.6, 'font-size': 1.4,
      fill: 'var(--plan-label)'
    });
    lab.textContent = "20 ft";
    g.appendChild(lab);
    return g;
  }

  /* ------------------------------------------------------------ minimap --
     A stripped-down plan for the walkthrough HUD and the tour, with a marker
     showing position and which way the camera is facing.
  ---------------------------------------------------------------------- */
  function minimap(floor) {
    var built = build(floor, { labels: false, interactive: false });
    var svg = built.svg;
    var marker = el('g', { 'data-marker': '1' });
    marker.appendChild(el('path', {
      d: 'M0,0 L-7,-15 A16,16 0 0,1 7,-15 Z',
      fill: 'var(--accent)', opacity: 0.32
    }));
    marker.appendChild(el('circle', {
      cx: 0, cy: 0, r: 2.1, fill: 'var(--accent)',
      stroke: '#fff', 'stroke-width': 0.7, 'vector-effect': 'non-scaling-stroke'
    }));
    built.root.appendChild(marker);

    return {
      svg: svg,
      /* x, y in feet; heading in radians, 0 = facing north (-y) */
      move: function (x, y, heading) {
        marker.setAttribute('transform',
          'translate(' + x.toFixed(2) + ',' + y.toFixed(2) + ') ' +
          'rotate(' + (heading * 180 / Math.PI).toFixed(1) + ')');
      }
    };
  }

  /* ------------------------------------------------------------ vignette --
     Not every space has a photograph - the concept sheets never covered the
     bathrooms, wardrobe, pantry or utility rooms.  Rather than show a blank
     placeholder, those rooms get a close-up of the plan with the room picked
     out, which is real information about where they sit.
  ---------------------------------------------------------------------- */
  function vignette(room) {
    var floor = room.floor === 'first' ? 'first' : 'site';
    if (room.floor === 'ground') floor = 'ground';

    var built = build(floor, { labels: false, interactive: false });
    var c = V.centre(room);

    /* frame the room with enough of its surroundings to give it context */
    var w = Math.max(room.rect[2] * 2.4, 34);
    var h = w * 0.625;
    if (h < room.rect[3] * 2.1) { h = room.rect[3] * 2.1; w = h / 0.625; }
    built.svg.setAttribute('viewBox',
      (c[0] - w / 2).toFixed(1) + ' ' + (c[1] - h / 2).toFixed(1) + ' ' +
      w.toFixed(1) + ' ' + h.toFixed(1));

    built.root.appendChild(el('rect', {
      x: room.rect[0], y: room.rect[1],
      width: room.rect[2], height: room.rect[3],
      rx: 0.4, fill: 'var(--accent)', 'fill-opacity': 0.34,
      stroke: 'var(--accent)', 'stroke-width': 2.4,
      'vector-effect': 'non-scaling-stroke'
    }));

    /* no label: the card and the panel already name the room, and a long
       name simply overruns a small highlight box */
    return built.svg;
  }

  /* -------------------------------------------------------- pan and zoom --
     Wheel and pinch zoom, drag to pan, clamped so the plan cannot be lost
     off screen.  Works with mouse, trackpad and touch.
  ---------------------------------------------------------------------- */
  function enablePanZoom(svg, root) {
    var scale = 1, tx = 0, ty = 0;
    var MIN = 1, MAX = 7;

    /* Read the viewBox from the attribute rather than svg.viewBox.baseVal:
       the attribute is always there, and this keeps the code working in
       environments that do not implement SVGAnimatedRect. */
    function viewBox() {
      var p = (svg.getAttribute('viewBox') || '0 0 100 100').split(/[\s,]+/);
      return { x: +p[0], y: +p[1], width: +p[2], height: +p[3] };
    }

    function apply() {
      root.setAttribute('transform',
        'translate(' + tx + ',' + ty + ') scale(' + scale + ')');
    }

    function clamp() {
      scale = Math.max(MIN, Math.min(MAX, scale));
      var vb = viewBox();
      var maxX = vb.width * (scale - 1);
      var maxY = vb.height * (scale - 1);
      tx = Math.max(-maxX, Math.min(0, tx));
      ty = Math.max(-maxY, Math.min(0, ty));
    }

    function pointIn(clientX, clientY) {
      var r = svg.getBoundingClientRect();
      var vb = viewBox();
      if (!r.width || !r.height) return [vb.x + vb.width / 2, vb.y + vb.height / 2];
      return [
        (clientX - r.left) / r.width * vb.width + vb.x,
        (clientY - r.top) / r.height * vb.height + vb.y
      ];
    }

    function zoomAt(factor, clientX, clientY) {
      var p = pointIn(clientX, clientY);
      var before = scale;
      scale *= factor;
      scale = Math.max(MIN, Math.min(MAX, scale));
      var k = scale / before;
      tx = p[0] - (p[0] - tx) * k;
      ty = p[1] - (p[1] - ty) * k;
      clamp();
      apply();
    }

    /* A plain wheel must scroll the page - the plan is tall enough to fill the
       viewport, so hijacking the wheel here makes the site feel broken.
       Ctrl/Cmd + wheel zooms, which is also what a trackpad pinch sends. */
    svg.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomAt(e.deltaY < 0 ? 1.14 : 1 / 1.14, e.clientX, e.clientY);
    }, { passive: false });

    var pointers = {}, lastMid = null, lastDist = 0, dragged = false;

    svg.addEventListener('pointerdown', function (e) {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      dragged = false;
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });

    svg.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      var ids = Object.keys(pointers);
      var prev = pointers[e.pointerId];
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };

      if (ids.length === 1) {
        /* at 1:1 a one-finger drag belongs to the page, not the plan */
        if (scale <= 1.001 && e.pointerType !== 'mouse') return;
        var r = svg.getBoundingClientRect();
        var vb = viewBox();
        if (!r.width || !r.height) return;
        var dx = (e.clientX - prev.x) / r.width * vb.width;
        var dy = (e.clientY - prev.y) / r.height * vb.height;
        if (Math.abs(dx) + Math.abs(dy) > 0.01) dragged = true;
        tx += dx; ty += dy;
        clamp(); apply();
      } else if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var dist = Math.hypot(a.x - b.x, a.y - b.y);
        var mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
        if (lastDist) {
          zoomAt(dist / lastDist, mid[0], mid[1]);
          dragged = true;
        }
        lastDist = dist;
        lastMid = mid;
      }
    });

    function up(e) {
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) { lastDist = 0; lastMid = null; }
    }
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);

    /* swallow the click that ends a drag, so panning never opens a room */
    svg.addEventListener('click', function (e) {
      if (dragged) { e.stopPropagation(); e.preventDefault(); }
    }, true);

    return {
      reset: function () { scale = 1; tx = 0; ty = 0; apply(); },
      zoomIn: function () {
        var r = svg.getBoundingClientRect();
        zoomAt(1.35, r.left + r.width / 2, r.top + r.height / 2);
      },
      zoomOut: function () {
        var r = svg.getBoundingClientRect();
        zoomAt(1 / 1.35, r.left + r.width / 2, r.top + r.height / 2);
      },
      /* centre the view on a room and zoom in a little */
      focus: function (room) {
        var vb = viewBox();
        var c = V.centre(room);
        scale = Math.max(1.9, Math.min(3.4,
          Math.min(vb.width / Math.max(12, room.rect[2] * 2.4),
                   vb.height / Math.max(12, room.rect[3] * 2.4))));
        tx = vb.width / 2 + vb.x - c[0] * scale;
        ty = vb.height / 2 + vb.y - c[1] * scale;
        clamp(); apply();
      }
    };
  }

  window.Plan = {
    build: build,
    minimap: minimap,
    vignette: vignette,
    enablePanZoom: enablePanZoom
  };
})();
