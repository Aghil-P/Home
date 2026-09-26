/* ==========================================================================
   First-person walkthrough.
   --------------------------------------------------------------------------
   The model is generated, not authored.  Walls are found by scanning a 1-foot
   occupancy grid built from VILLA.rooms: wherever two neighbouring cells
   belong to different spaces there is a wall, and wherever the two spaces
   list each other in `connects` that wall gets a doorway.  So the 3D model
   and the floor plans are the same geometry by construction.

   This is a stylised architectural model - correct massing, adjacency and
   materials - not a photoreal render.
   ========================================================================== */

(function () {
  'use strict';

  var V = window.VILLA;
  var FT = V.FT;
  var FH = V.floorHeight;          // storey height, feet
  var EYE = 5.4;                   // eye height, feet
  var RADIUS = 1.15;               // player collision radius, feet
  var DOOR_W = 3.6;                // clear door width, feet
  var DOOR_H = 7.2;
  var WALL_T = 0.6;                // wall thickness, feet

  var ENCLOSED = { room: 1, circulation: 1 };

  var THREE = window.THREE;
  var scene, camera, renderer, clock;
  var root = {};                   // named groups
  var solids = [];                 // collision segments
  var pickables = [];              // meshes carrying userData.roomId
  var waters = [];
  var focusPoints = {};   // room id -> where its furniture sits
  var lights = { day: null, night: null };
  var state = {
    open: false, floor: 'ground', theme: 'day',
    x: 44, y: 8, yaw: Math.PI, pitch: 0,
    vx: 0, vy: 0, ready: false, raf: 0, quality: 1
  };
  var keys = {};
  var dom = {};
  var mini = null;
  var onRoomPick = null;

  /* ------------------------------------------------------------ helpers */

  function wx(xft) { return (xft - V.plot.w / 2) * FT; }
  function wz(yft) { return (yft - V.plot.d / 2) * FT; }
  function wu(ft) { return ft * FT; }

  function mat(color, opts) {
    opts = opts || {};
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: opts.rough === undefined ? 0.92 : opts.rough,
      metalness: opts.metal || 0,
      transparent: !!opts.opacity,
      opacity: opts.opacity === undefined ? 1 : opts.opacity,
      side: opts.side || THREE.FrontSide,
      emissive: new THREE.Color(opts.emissive || 0x000000),
      emissiveIntensity: opts.emissiveIntensity || 1,
      flatShading: !!opts.flat
    });
  }

  var M = {};
  function buildMaterials() {
    M.wall = mat(0xd9d0be, { rough: 0.95 });
    M.wallIn = mat(0xe4ddcd, { rough: 0.96 });
    M.stone = mat(0x9c9086, { rough: 0.9 });
    M.wood = mat(0x8a5a33, { rough: 0.75 });
    M.woodDark = mat(0x5d3c22, { rough: 0.7 });
    M.floorIn = mat(0xd8d2c6, { rough: 0.6 });
    M.floorCirc = mat(0xc9c2b4, { rough: 0.65 });
    M.deck = mat(0x9a6638, { rough: 0.8 });
    M.paving = mat(0xbdb6a8, { rough: 0.92 });
    M.grass = mat(0x4f7a42, { rough: 1 });
    M.bed = mat(0x35562f, { rough: 1 });
    M.water = mat(0x2d7f9e, { rough: 0.08, metal: 0.25, opacity: 0.86 });
    M.glass = mat(0xa8c4cc, { rough: 0.05, metal: 0.1, opacity: 0.27,
      side: THREE.DoubleSide });
    M.metal = mat(0x4b4b48, { rough: 0.5, metal: 0.35 });
    M.roof = mat(0x4a3a30, { rough: 0.85 });
    M.roofUnder = mat(0x7a5638, { rough: 0.8, side: THREE.DoubleSide });
    M.fabric = mat(0xc2b8a6, { rough: 1 });
    M.dark = mat(0x241f1c, { rough: 0.9 });
    M.screen = mat(0x101820, { rough: 0.3, emissive: 0x1b3a5c,
      emissiveIntensity: 0.5 });
    M.leaf = mat(0x3f6b34, { rough: 1, side: THREE.DoubleSide, flat: true });
    M.leafLight = mat(0x5b8a3c, { rough: 1, side: THREE.DoubleSide, flat: true });
    M.trunk = mat(0x6a5240, { rough: 1 });

    /* interior finishes, so rooms read as rooms rather than as boxes */
    M.floorWood = mat(0x8d6440, { rough: 0.55 });
    M.floorTile = mat(0xcfc9c0, { rough: 0.35 });
    M.floorDark = mat(0x3a2f2a, { rough: 0.7 });
    M.ceiling = mat(0xefe9dd, { rough: 0.95 });
    M.ceilingWood = mat(0x7a5638, { rough: 0.8 });
    M.linen = mat(0xf2eee6, { rough: 1 });
    M.cushion = mat(0xa8977f, { rough: 1 });
    M.accent = mat(0x3f5d4a, { rough: 1 });
    M.rug = mat(0xb9a98d, { rough: 1 });
    M.rugDark = mat(0x6d5f4c, { rough: 1 });
    M.marble = mat(0xe6e2da, { rough: 0.25 });
    /* There is no environment map in this scene, and in three.js a highly
       metallic surface with nothing to reflect renders almost black.  Metals
       here stay low-metalness so they read as bright brass and glass. */
    M.brass = mat(0xc8a45e, { rough: 0.4, metal: 0.3 });
    M.lampShade = mat(0xfdf3dd, { rough: 0.9, emissive: 0x3a2a12 });
    M.art = mat(0x6d7f86, { rough: 0.8 });
    M.pot = mat(0x8a7f70, { rough: 0.9 });
    M.mirror = mat(0xdae3e7, { rough: 0.09, metal: 0.2 });
  }

  function box(w, h, d, material, x, y, z, parent) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    (parent || scene).add(m);
    return m;
  }

  /* --------------------------------------------------------- occupancy --
     A 1-foot grid over the plot recording which room owns each cell.
  ---------------------------------------------------------------------- */
  function occupancy(floor) {
    var W = V.plot.w, D = V.plot.d;
    var enclosed = new Array(W * D);
    var any = new Array(W * D);

    V.rooms.forEach(function (r) {
      if (r.floor !== floor) return;
      var x0 = Math.max(0, Math.floor(r.rect[0]));
      var y0 = Math.max(0, Math.floor(r.rect[1]));
      var x1 = Math.min(W, Math.ceil(r.rect[0] + r.rect[2]));
      var y1 = Math.min(D, Math.ceil(r.rect[1] + r.rect[3]));
      for (var x = x0; x < x1; x++) {
        for (var y = y0; y < y1; y++) {
          var i = y * W + x;
          if (ENCLOSED[r.kind]) enclosed[i] = r.id;
          /* plunge pool and shower sit inside the terrace: keep the inner one */
          if (!any[i] || r.kind === 'water') any[i] = r.id;
        }
      }
    });

    return {
      enc: function (x, y) {
        if (x < 0 || y < 0 || x >= W || y >= D) return null;
        return enclosed[y * W + x] || null;
      },
      any: function (x, y) {
        if (x < 0 || y < 0 || x >= W || y >= D) return null;
        return any[y * W + x] || null;
      }
    };
  }

  function connected(aId, bId) {
    if (!aId || !bId) return false;
    var a = V.byId(aId);
    return !!(a && a.connects && a.connects.indexOf(bId) >= 0);
  }

  /* ------------------------------------------------------------- walls --
     Scan the grid for boundaries, merge runs, then emit wall geometry with
     doorways where the two sides are connected.
  ---------------------------------------------------------------------- */
  function buildWalls(floor, base) {
    var occ = occupancy(floor);
    var W = V.plot.w, D = V.plot.d;
    var segs = [];

    /* vertical walls: constant x, running along y */
    for (var x = 0; x <= W; x++) {
      var run = null;
      for (var y = 0; y <= D; y++) {
        var a = occ.enc(x - 1, y), b = occ.enc(x, y);
        var key = (y < D && a !== b) ? a + '|' + b : null;
        if (run && run.key !== key) { segs.push(run); run = null; }
        if (key && !run) {
          run = { vertical: true, at: x, from: y, to: y + 1, key: key,
            a: a, b: b, outA: occ.any(x - 1, y), outB: occ.any(x, y) };
        } else if (key && run) {
          run.to = y + 1;
        }
      }
      if (run) segs.push(run);
    }

    /* horizontal walls: constant y, running along x */
    for (var yy = 0; yy <= D; yy++) {
      var run2 = null;
      for (var xx = 0; xx <= W; xx++) {
        var a2 = occ.enc(xx, yy - 1), b2 = occ.enc(xx, yy);
        var key2 = (xx < W && a2 !== b2) ? a2 + '|' + b2 : null;
        if (run2 && run2.key !== key2) { segs.push(run2); run2 = null; }
        if (key2 && !run2) {
          run2 = { vertical: false, at: yy, from: xx, to: xx + 1, key: key2,
            a: a2, b: b2, outA: occ.any(xx, yy - 1), outB: occ.any(xx, yy) };
        } else if (key2 && run2) {
          run2.to = xx + 1;
        }
      }
      if (run2) segs.push(run2);
    }

    segs.forEach(function (s) { emitWall(s, floor, base); });
  }

  function openKind(id) {
    if (!id) return 'outside';
    var r = V.byId(id);
    if (!r) return 'outside';
    if (ENCLOSED[r.kind]) return 'room';
    if (r.kind === 'open' || r.kind === 'water') return 'court';
    return 'outside';
  }

  function emitWall(s, floor, base) {
    var inside = s.a && s.b;                    // wall between two rooms
    var roomId = s.a || s.b;
    var otherRaw = s.a ? s.outB : s.outA;       // what is on the open side
    var other = openKind(s.a && s.b ? null : otherRaw);
    var length = s.to - s.from;
    if (length <= 0) return;

    var isCourt = !inside && other === 'court';
    var host = V.byId(roomId);
    var hostIsCirc = host && host.kind === 'circulation';

    /* A verandah facing the courtyard is a colonnade, not a wall. */
    if (isCourt && hostIsCirc) {
      colonnade(s, base);
      return;
    }

    /* Cut an opening wherever the two sides name each other in `connects` -
       including where a room opens onto the garden, the deck or the pool
       terrace, which is most of how this house works. */
    var neighbourId = inside ? s.b : otherRaw;
    var gaps = [];
    if (connected(roomId, neighbourId) || connected(neighbourId, roomId)) {
      gaps.push(inside
        ? doorGap(s)
        : doorGap(s, Math.min(length - 1.2, 11)));   // generous to outdoors
    }

    var glazed = isCourt || (!inside && other === 'outside' && host &&
      host.kind === 'room' && length >= 8 && !/bath|store|storage|pantry|powder|laundry|theatre/.test(roomId));

    var pieces = splitRun(s.from, s.to, gaps);
    pieces.forEach(function (p) {
      wallBox(s, p[0], p[1], base, FH, inside ? M.wallIn : M.wall);
    });

    /* lintel over each doorway */
    gaps.forEach(function (g) {
      wallBox(s, g[0], g[1], base + DOOR_H, FH - DOOR_H, inside ? M.wallIn : M.wall);
    });

    if (glazed) {
      /* a glazed band: sill 2.5ft, head 8.5ft, minus any opening */
      var glassPieces = splitRun(s.from, s.to, gaps);
      glassPieces.forEach(function (p) {
        if (p[1] - p[0] < 1.5) return;
        wallBox(s, p[0] + 0.15, p[1] - 0.15, base + 2.6, 5.9, M.glass, true);
      });
    }

    /* collision: the solid parts only */
    pieces.forEach(function (p) {
      solids.push(segFor(s, p[0], p[1], floor));
    });
  }

  function doorGap(s, width) {
    var length = s.to - s.from;
    var w = Math.min(width || DOOR_W, Math.max(1.6, length - 1.2));
    var mid = (s.from + s.to) / 2;
    return [mid - w / 2, mid + w / 2];
  }

  function splitRun(from, to, gaps) {
    var out = [], cursor = from;
    gaps.slice().sort(function (a, b) { return a[0] - b[0]; }).forEach(function (g) {
      if (g[0] > cursor) out.push([cursor, g[0]]);
      cursor = Math.max(cursor, g[1]);
    });
    if (to > cursor) out.push([cursor, to]);
    return out.filter(function (p) { return p[1] - p[0] > 0.05; });
  }

  function wallBox(s, from, to, base, height, material, noShadow) {
    if (to - from <= 0.05 || height <= 0.05) return;
    var len = to - from;
    var m;
    if (s.vertical) {
      m = box(wu(WALL_T), wu(height), wu(len), material,
        wx(s.at), wu(base + height / 2), wz((from + to) / 2));
    } else {
      m = box(wu(len), wu(height), wu(WALL_T), material,
        wx((from + to) / 2), wu(base + height / 2), wz(s.at));
    }
    if (noShadow) { m.castShadow = false; m.receiveShadow = false; }
    root.house.add(m);
    return m;
  }

  function segFor(s, from, to, floor) {
    return s.vertical
      ? { x1: s.at, y1: from, x2: s.at, y2: to, floor: floor }
      : { x1: from, y1: s.at, x2: to, y2: s.at, floor: floor };
  }

  function colonnade(s, base) {
    var len = s.to - s.from;
    var n = Math.max(2, Math.round(len / 9));
    for (var i = 0; i <= n; i++) {
      var t = s.from + (len * i) / n;
      var px = s.vertical ? s.at : t;
      var py = s.vertical ? t : s.at;
      box(wu(0.85), wu(FH - 0.9), wu(0.85), M.wood,
        wx(px), wu(base + (FH - 0.9) / 2), wz(py)).receiveShadow = true;
    }
    /* beam along the top */
    if (s.vertical) {
      box(wu(0.9), wu(0.9), wu(len), M.woodDark,
        wx(s.at), wu(base + FH - 0.45), wz((s.from + s.to) / 2));
    } else {
      box(wu(len), wu(0.9), wu(0.9), M.woodDark,
        wx((s.from + s.to) / 2), wu(base + FH - 0.45), wz(s.at));
    }
  }

  /* -------------------------------------------------------------- slabs */

  function buildSlabs(floor, base) {
    V.rooms.forEach(function (r) {
      if (r.floor !== floor) return;
      /* voids are holes through the floor, so they get no surface at all */
      if (r.voidSpace) return;
      var m;
      var w = wu(r.rect[2]), d = wu(r.rect[3]);
      var cx = wx(r.rect[0] + r.rect[2] / 2), cz = wz(r.rect[1] + r.rect[3] / 2);

      if (r.kind === 'water') {
        addWater(r, base);
        return;
      }
      var material =
        r.kind === 'room' ? M.floorIn :
        r.kind === 'circulation' ? M.floorCirc :
        r.kind === 'landscape' ? M.grass :
        r.kind === 'paving' ? M.paving :
        r.kind === 'open' ? M.paving : M.paving;

      if (r.id === 'rear-deck' || r.id === 'master-terrace') material = M.deck;
      /* the floor finish is part of how a room reads from inside */
      if (r.kind === 'room') {
        if (/bedroom|travel-room|master-lounge|family-lounge/.test(r.id)) {
          material = M.floorWood;
        } else if (/bath|powder|laundry|pantry|dirty-kitchen/.test(r.id)) {
          material = M.floorTile;
        } else if (r.id === 'home-theatre') {
          material = M.floorDark;
        }
      }

      m = box(w, wu(0.5), d, material, cx, wu(base - 0.25), cz);
      m.castShadow = false;
      m.userData.roomId = r.id;
      m.userData.floor = floor;
      pickables.push(m);
      root.house.add(m);

      if (r.kind === 'open' && r.id.indexOf('courtyard') === 0) {
        courtyardLandscape(r, base);
      }
      if (r.kind === 'structure') pavilion(r, base);
      if (r.kind === 'landscape') groundCover(r, base);

      furnish(r, base);
    });
  }

  function addWater(r, base) {
    var seg = 18;
    var g = new THREE.PlaneGeometry(wu(r.rect[2] - 1), wu(r.rect[3] - 1), seg,
      Math.max(2, Math.round(seg * r.rect[3] / r.rect[2])));
    g.rotateX(-Math.PI / 2);
    var m = new THREE.Mesh(g, M.water);
    m.position.set(wx(r.rect[0] + r.rect[2] / 2), wu(base + 0.05),
      wz(r.rect[1] + r.rect[3] / 2));
    m.userData.roomId = r.id;
    m.userData.base = wu(base + 0.05);
    m.receiveShadow = true;
    root.house.add(m);
    pickables.push(m);
    waters.push(m);

    /* pool basin and coping */
    box(wu(r.rect[2]), wu(1.6), wu(r.rect[3]), M.stone,
      wx(r.rect[0] + r.rect[2] / 2), wu(base - 0.8),
      wz(r.rect[1] + r.rect[3] / 2)).receiveShadow = true;
  }

  function courtyardLandscape(r, base) {
    var x = r.rect[0], y = r.rect[1], w = r.rect[2], d = r.rect[3];
    /* lawn panel */
    box(wu(w * 0.42), wu(0.18), wu(d * 0.46), M.grass,
      wx(x + w * 0.30), wu(base + 0.14), wz(y + d * 0.34));
    /* planting bed */
    box(wu(w * 0.3), wu(0.5), wu(d * 0.3), M.bed,
      wx(x + w * 0.74), wu(base + 0.3), wz(y + d * 0.7));
    /* water feature */
    var wf = box(wu(w * 0.26), wu(0.6), wu(d * 0.22), M.water,
      wx(x + w * 0.26), wu(base + 0.3), wz(y + d * 0.76));
    wf.receiveShadow = true;
    /* stepping stones */
    for (var i = 0; i < 5; i++) {
      box(wu(2), wu(0.2), wu(1.5), M.stone,
        wx(x + w * 0.5 + (i - 2) * 2.6), wu(base + 0.15), wz(y + d * 0.52));
    }
    /* the feature tree, set off the centre line so it frames the courtyard
       rather than blocking the view straight through from the foyer */
    tree(x + w * 0.68, y + d * 0.32, base, 1.5, 'tree', true);
  }

  function groundCover(r, base) {
    /* low shrub mass so planted areas are not flat colour */
    var n = Math.max(3, Math.round(r.rect[2] * r.rect[3] / 120));
    for (var i = 0; i < n; i++) {
      var t = (i * 0.618) % 1;
      var u = (i * 0.379) % 1;
      box(wu(2.4), wu(1.4), wu(2.4), M.bed,
        wx(r.rect[0] + 1 + t * (r.rect[2] - 2)), wu(base + 0.7),
        wz(r.rect[1] + 1 + u * (r.rect[3] - 2)));
    }
  }

  function pavilion(r, base) {
    var x = r.rect[0], y = r.rect[1], w = r.rect[2], d = r.rect[3];
    [[x + 0.8, y + 0.8], [x + w - 0.8, y + 0.8],
     [x + 0.8, y + d - 0.8], [x + w - 0.8, y + d - 0.8]].forEach(function (p) {
      box(wu(0.8), wu(9), wu(0.8), M.wood, wx(p[0]), wu(base + 4.5), wz(p[1]));
    });
    /* pitched roof */
    var roof = pitched(x - 1.2, y - 1.2, x + w + 1.2, y + d + 1.2,
      base + 9, base + 12.5, 'x');
    root.house.add(roof);
    box(wu(w * 0.62), wu(1.3), wu(d * 0.5), M.fabric,
      wx(x + w / 2), wu(base + 1.1), wz(y + d / 2));
  }

  /* A simple ridged roof over a rectangle: rises from the edges to a ridge
     along the centre of the given axis. */
  function pitched(x0, y0, x1, y1, hEave, hRidge, axis) {
    var g = new THREE.BufferGeometry();
    var verts, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    function P(xf, yf, h) { return [wx(xf), wu(h), wz(yf)]; }
    var a, b, c, d, e, f;
    if (axis === 'x') {
      a = P(x0, y0, hEave); b = P(x1, y0, hEave);
      c = P(x1, y1, hEave); d = P(x0, y1, hEave);
      e = P(x0, my, hRidge); f = P(x1, my, hRidge);
    } else {
      a = P(x0, y0, hEave); b = P(x1, y0, hEave);
      c = P(x1, y1, hEave); d = P(x0, y1, hEave);
      e = P(mx, y0, hRidge); f = P(mx, y1, hRidge);
    }
    if (axis === 'x') {
      verts = [].concat(a, b, f, a, f, e, d, e, f, d, f, c);
    } else {
      verts = [].concat(a, e, f, a, f, d, e, b, c, e, c, f);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    var m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: 0x4a3a30, roughness: 0.85, side: THREE.DoubleSide
    }));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  /* --------------------------------------------------------------- roof */

  function buildRoof() {
    var H = V.house;
    var top = FH * 2;
    var court = V.byId('courtyard');
    var eaves = 3;

    /* four bands around the courtyard, each sloping down toward the court,
       which is the traditional courtyard-house section */
    var bands = [
      { x0: H.x - eaves, y0: H.y - eaves, x1: H.x + H.w + eaves, y1: court.rect[1],
        axis: 'y', flip: false },
      { x0: H.x - eaves, y0: court.rect[1] + court.rect[3],
        x1: H.x + H.w + eaves, y1: H.y + H.d + eaves, axis: 'y', flip: true },
      { x0: H.x - eaves, y0: court.rect[1], x1: court.rect[0],
        y1: court.rect[1] + court.rect[3], axis: 'x', flip: false },
      { x0: court.rect[0] + court.rect[2], y0: court.rect[1],
        x1: H.x + H.w + eaves, y1: court.rect[1] + court.rect[3],
        axis: 'x', flip: true }
    ];

    bands.forEach(function (b) {
      var g = new THREE.BufferGeometry();
      function P(xf, yf, h) { return [wx(xf), wu(h), wz(yf)]; }
      var hi = top + 3.2, lo = top + 0.4;
      var v;
      if (b.axis === 'y') {
        var yHi = b.flip ? b.y1 : b.y0;
        var yLo = b.flip ? b.y0 : b.y1;
        v = [].concat(
          P(b.x0, yHi, hi), P(b.x1, yHi, hi), P(b.x1, yLo, lo),
          P(b.x0, yHi, hi), P(b.x1, yLo, lo), P(b.x0, yLo, lo));
      } else {
        var xHi = b.flip ? b.x1 : b.x0;
        var xLo = b.flip ? b.x0 : b.x1;
        v = [].concat(
          P(xHi, b.y0, hi), P(xHi, b.y1, hi), P(xLo, b.y1, lo),
          P(xHi, b.y0, hi), P(xLo, b.y1, lo), P(xLo, b.y0, lo));
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      g.computeVertexNormals();
      var m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
        color: 0x4a3a30, roughness: 0.88, side: THREE.DoubleSide
      }));
      m.castShadow = true;
      root.house.add(m);
    });

    /* the master terrace stays open to the sky, so lift a light pergola only */
    var mt = V.byId('master-terrace');
    for (var i = 0; i <= 4; i++) {
      box(wu(0.6), wu(0.4), wu(mt.rect[3] - 2),
        M.woodDark, wx(mt.rect[0] + 3 + i * 4), wu(FH * 2 + 0.6),
        wz(mt.rect[1] + mt.rect[3] / 2));
    }
  }

  /* ---------------------------------------------------------- furniture --
     Rooms are furnished from simple primitives, but with enough of the real
     pieces - bed, headboard, nightstands, rug, art, curtains, planting - that
     each space reads as that room from inside rather than as an empty shell.
     Everything is placed relative to the room's own rectangle, so the fittings
     follow if the plan changes.
  ---------------------------------------------------------------------- */

  function furnish(r, base) {
    var c = V.centre(r), cx = c[0], cy = c[1];
    var W = r.rect[2], D = r.rect[3];
    var id = r.id;
    var fx = 0, fy = 0, fw = 0;   // volume-weighted centre of the furniture

    /* place a box by room-relative offsets, sitting ON the floor */
    function b(w, h, d, material, ox, oy, oz, opts) {
      var m = box(wu(w), wu(h), wu(d), material,
        wx(cx + (ox || 0)), wu(base + (oy || 0) + h / 2), wz(cy + (oz || 0)));
      if (opts && opts.noShadow) { m.castShadow = false; }
      /* Only free-standing furniture should pull the viewpoint: a mirror,
         a screen or a picture is flat against a wall, and aiming at one puts
         your nose against it. */
      var vol = w * h * d;
      if (vol > 6 && h >= 0.8 && Math.min(w, d) >= 0.8) {
        fx += (cx + (ox || 0)) * vol; fy += (cy + (oz || 0)) * vol; fw += vol;
      }
      return m;
    }

    /* a flat mat lying on the floor */
    function rug(w, d, material, ox, oz) {
      var m = b(w, 0.12, d, material, ox, 0, oz, { noShadow: true });
      m.receiveShadow = true;
      return m;
    }

    /* a framed picture on a wall; side is 'n' | 's' | 'e' | 'w' */
    function art(side, w, h, at, height) {
      var t = 0.18, off = 0.45;
      height = height === undefined ? 4.6 : height;
      at = at || 0;
      if (side === 'n' || side === 's') {
        var z = (side === 'n' ? -D / 2 + off : D / 2 - off);
        b(w, h, t, M.woodDark, at, height, z, { noShadow: true });
        b(w - 0.35, h - 0.35, t * 0.5, M.art, at, height + 0.17, z, { noShadow: true });
      } else {
        var x = (side === 'w' ? -W / 2 + off : W / 2 - off);
        b(t, h, w, M.woodDark, x, height, at, { noShadow: true });
        b(t * 0.5, h - 0.35, w - 0.35, M.art, x, height + 0.17, at, { noShadow: true });
      }
    }

    /* a table or floor lamp; the shade glows warmly at night */
    function lamp(ox, oz, standH) {
      standH = standH || 1.1;
      b(0.18, standH, 0.18, M.brass, ox, 0, oz, { noShadow: true });
      b(0.95, 0.75, 0.95, M.lampShade, ox, standH, oz, { noShadow: true });
    }

    /* pendant hanging from the ceiling */
    function pendant(ox, oz, drop) {
      var h = (r.height || FH);
      drop = drop || 3.2;
      b(0.1, drop, 0.1, M.metal, ox, h - drop, oz, { noShadow: true });
      b(1.5, 0.8, 1.5, M.lampShade, ox, h - drop - 0.8, oz, { noShadow: true });
    }

    function plant(ox, oz, scale) {
      scale = scale || 1;
      b(1.2 * scale, 1.3 * scale, 1.2 * scale, M.pot, ox, 0, oz);
      var g = new THREE.Mesh(
        new THREE.IcosahedronGeometry(wu(1.05 * scale), 0), M.leaf);
      g.position.set(wx(cx + ox), wu(base + 2.3 * scale), wz(cy + oz));
      g.castShadow = true;
      root.house.add(g);
    }

    /* full-height curtain panels either side of an opening */
    function curtains(side, at, spread) {
      var h = (r.height || FH) - 0.6;
      spread = spread || 4;
      [-1, 1].forEach(function (k) {
        if (side === 'n' || side === 's') {
          b(1.1, h, 0.35, M.linen, at + k * spread, 0,
            (side === 'n' ? -D / 2 + 0.6 : D / 2 - 0.6), { noShadow: true });
        } else {
          b(0.35, h, 1.1, M.linen,
            (side === 'w' ? -W / 2 + 0.6 : W / 2 - 0.6), 0, at + k * spread,
            { noShadow: true });
        }
      });
    }

    /* a made bed, headboard against the north wall of the room */
    function bed(width, length, ox) {
      ox = ox || 0;
      var z = -D / 2 + length / 2 + 1.4;
      b(width, 1.25, length, M.woodDark, ox, 0, z);
      b(width - 0.3, 0.75, length - 0.4, M.linen, ox, 1.25, z);
      b(width - 0.3, 0.28, length * 0.42, M.cushion, ox, 2.0,
        z + length * 0.24, { noShadow: true });
      [-1, 1].forEach(function (k) {
        b(width * 0.38, 0.45, 1.5, M.linen, ox + k * width * 0.22, 2.0,
          z - length / 2 + 1.2, { noShadow: true });
      });
      b(width + 1.6, 4.2, 0.4, M.wood, ox, 0, -D / 2 + 0.45);
      [-1, 1].forEach(function (k) {
        var nx = ox + k * (width / 2 + 1.1);
        b(1.6, 1.9, 1.5, M.woodDark, nx, 0, -D / 2 + 1.6);
        lamp(nx, -D / 2 + 1.6, 1.0);
      });
      rug(width + 4, length + 1.5, M.rug, ox, z + 0.8);
    }

    function sofa(width, ox, oz, facing) {
      facing = facing || 1;
      b(width, 1.4, 3, M.fabric, ox, 0, oz);
      b(width, 1.5, 0.7, M.fabric, ox, 1.2, oz - facing * 1.5);
      [-1, 1].forEach(function (k) {
        b(0.7, 1.7, 3, M.fabric, ox + k * (width / 2 - 0.35), 0.5, oz,
          { noShadow: true });
        b(width * 0.22, 0.35, 0.8, M.cushion,
          ox + k * width * 0.26, 1.5, oz - facing * 0.9, { noShadow: true });
      });
    }

    function counter(len, ox, oz, along) {
      if (along === 'x') {
        b(len, 2.9, 2, M.woodDark, ox, 0, oz);
        b(len, 0.25, 2.2, M.marble, ox, 2.9, oz, { noShadow: true });
      } else {
        b(2, 2.9, len, M.woodDark, ox, 0, oz);
        b(2.2, 0.25, len, M.marble, ox, 2.9, oz, { noShadow: true });
      }
    }

    /* Open shelving with visible boards and books - a single solid box just
       reads as a brown wall from inside the room. */
    function shelves(side, len, at, height) {
      height = height || 7;
      var t = 1.1, boards = 4;
      var horiz = (side === 'n' || side === 's');
      var pos = horiz
        ? (side === 'n' ? -D / 2 + t / 2 + 0.3 : D / 2 - t / 2 - 0.3)
        : (side === 'w' ? -W / 2 + t / 2 + 0.3 : W / 2 - t / 2 - 0.3);

      function piece(w, h, d, mtl, ox, oy, oz, opts) {
        return horiz ? b(w, h, d, mtl, ox, oy, oz, opts)
                     : b(d, h, w, mtl, oz, oy, ox, opts);
      }

      piece(len, height, 0.3, M.woodDark, at, 0,
        pos + (side === 'n' || side === 'w' ? -t / 2 + 0.15 : t / 2 - 0.15));
      for (var i = 0; i <= boards; i++) {
        piece(len, 0.22, t, M.wood, at, i * (height / boards), pos,
          { noShadow: true });
      }
      /* books: short blocks in a few muted colours */
      var shades = [M.accent, M.woodDark, M.cushion, M.art, M.rugDark];
      for (var lvl = 0; lvl < boards; lvl++) {
        var run = -len / 2 + 0.6;
        var guard = 0;
        while (run < len / 2 - 1 && guard++ < 24) {
          var bw = 0.55 + ((lvl * 7 + guard * 3) % 5) * 0.22;
          if (run + bw > len / 2 - 0.6) break;
          piece(bw, 1.1 + ((guard * 5) % 3) * 0.25, t - 0.45,
            shades[(lvl + guard) % shades.length],
            at + run + bw / 2, lvl * (height / boards) + 0.22, pos,
            { noShadow: true });
          run += bw + 0.12;
        }
      }
    }

    /* ---------------------------------------------------------------- */

    if (id === 'master-bedroom') {
      bed(7, 7.5, -1.5);
      b(5, 1.4, 1.6, M.cushion, -1.5, 0, -D / 2 + 10.5);
      b(2.6, 2.4, 2.6, M.fabric, W / 2 - 3, 0, D / 2 - 3.2);
      b(1.6, 1.4, 1.6, M.woodDark, W / 2 - 5.4, 0, D / 2 - 3.2);
      art('n', 4.5, 3, 5.5, 5.4);
      plant(-W / 2 + 2, D / 2 - 2.4, 1.15);
      curtains('s', 0, 7);
      pendant(-1.5, 2.5);

    } else if (/^bedroom-|guest-bedroom/.test(id)) {
      bed(6, 6.8, W > 15 ? -1.5 : 0);
      b(2.2, 7, 5.5, M.woodDark, W / 2 - 1.5, 0, D / 2 - 3.5);
      art('n', 3.6, 2.6, W > 15 ? 5 : -4.5, 5.2);
      plant(-W / 2 + 1.8, D / 2 - 1.8, 0.9);
      curtains('s', 0, Math.min(5, W / 2 - 1.5));

    } else if (id === 'master-lounge') {
      sofa(7, 0, -1.5, 1);
      b(3.6, 1.1, 2, M.woodDark, 0, 0, 1.6);
      b(2.4, 2.2, 2.4, M.fabric, -W / 2 + 2.6, 0, 3.4);
      rug(9, 7, M.rugDark, 0, 0.5);
      art('w', 3.4, 2.6, 0, 5);
      plant(W / 2 - 2, -D / 2 + 2.4, 1);
      lamp(W / 2 - 2.2, 2.5, 3.4);

    } else if (/living|family-lounge/.test(id) && r.kind === 'room') {
      sofa(Math.min(9, W - 4), -1, -2, 1);
      b(3, 1.4, 6, M.fabric, -W / 2 + 2.2, 0, 1.5);
      b(4.2, 1.2, 2.4, M.woodDark, 0, 0, 1.4);
      b(1.3, 0.5, 1.3, M.accent, 0, 1.2, 1.4, { noShadow: true });
      b(Math.min(10, W - 5), 0.9, 1.4, M.woodDark, 2, 0, D / 2 - 1.2);
      b(Math.min(7, W - 7), 4, 0.25, M.screen, 2, 2.4, D / 2 - 0.9,
        { noShadow: true });
      rug(Math.min(12, W - 3), Math.min(9, D - 3), M.rug, 0, 0.5);
      art('n', 5, 3.2, -2, 5.4);
      plant(W / 2 - 2, -D / 2 + 2.2, 1.2);
      plant(-W / 2 + 1.8, D / 2 - 2.2, 0.85);
      pendant(0, 1.4, 4);

    } else if (id === 'dining') {
      b(9, 0.35, 4, M.woodDark, 0, 2.35, 0, { noShadow: true });
      [-1, 1].forEach(function (k) {
        b(0.5, 2.35, 0.5, M.woodDark, k * 3.6, 0, 0);
      });
      for (var dc = -2; dc <= 2; dc++) {
        if (dc === 0) continue;
        [-1, 1].forEach(function (k) {
          b(1.4, 1.5, 1.4, M.fabric, dc * 1.9, 0, k * 3);
          b(1.4, 1.6, 0.25, M.woodDark, dc * 1.9, 1.5, k * 3.6, { noShadow: true });
        });
      }
      [-1, 1].forEach(function (k) {
        b(1.4, 1.5, 1.4, M.fabric, k * 5.4, 0, 0);
      });
      b(6, 2.6, 1.6, M.woodDark, 0, 0, -D / 2 + 1.1);
      rug(13, 8, M.rugDark, 0, 0);
      art('n', 4, 2.8, 0, 5.6);
      [-2.8, 0, 2.8].forEach(function (px) { pendant(px, 0, 3.6); });
      plant(W / 2 - 1.8, D / 2 - 2, 1);

    } else if (id === 'main-kitchen') {
      counter(W - 2.5, 0, -D / 2 + 1.3, 'x');
      b(W - 3, 2.6, 1.5, M.woodDark, 0, 5.8, -D / 2 + 1, { noShadow: true });
      b(3.4, 2.2, 1.6, M.metal, 2.5, 5.9, -D / 2 + 1.1, { noShadow: true });
      b(8, 3, 3.4, M.woodDark, 0, 0, 1.8);
      b(8.6, 0.3, 4, M.marble, 0, 3, 1.8, { noShadow: true });
      for (var st = -1; st <= 1; st++) {
        b(1.2, 2.2, 1.2, M.wood, st * 2.4, 0, 4.4);
      }
      b(2.4, 6.4, 2, M.woodDark, -W / 2 + 1.6, 0, D / 2 - 2.5);
      pendant(-2.4, 1.8, 3.4);
      pendant(2.4, 1.8, 3.4);
      plant(W / 2 - 1.4, D / 2 - 1.6, 0.8);

    } else if (/dirty-kitchen|pantry|laundry|service-lobby|storage|store-first/.test(id)) {
      counter(Math.max(3, W - 1.6), 0, -D / 2 + 1.2, 'x');
      shelves('s', Math.max(3, W - 1.6), 0, 6.4);
      if (/laundry/.test(id)) {
        b(2.2, 2.6, 2.2, M.metal, -W / 2 + 1.6, 0, D / 2 - 2);
        b(2.2, 2.6, 2.2, M.metal, -W / 2 + 4, 0, D / 2 - 2);
      }

    } else if (id === 'home-theatre') {
      b(W - 3, 5.4, 0.3, M.screen, 0, 2.6, -D / 2 + 0.8, { noShadow: true });
      b(W - 2.4, 0.5, 0.5, M.woodDark, 0, 8.2, -D / 2 + 0.9, { noShadow: true });
      for (var row = 0; row < 2; row++) {
        for (var seat = 0; seat < 4; seat++) {
          var sx = (seat - 1.5) * 2.7;
          var sz = -D / 2 + 5.4 + row * 4;
          b(2.3, 1.4, 2.6, M.dark, sx, row * 1.1, sz);
          b(2.3, 2.2, 0.6, M.dark, sx, row * 1.1 + 1.2, sz + 1.3);
          b(0.5, 1.2, 2.2, M.dark, sx - 1.2, row * 1.1 + 1.2, sz, { noShadow: true });
        }
      }
      b(W - 4, 1.1, 2.8, M.floorDark, 0, 0, -D / 2 + 9.6, { noShadow: true });
      b(3.4, 3, 1.6, M.woodDark, 0, 0, D / 2 - 1.1);
      [-1, 1].forEach(function (k) {
        b(0.5, 1.2, 0.3, M.lampShade, k * (W / 2 - 0.7), 4.6, 0, { noShadow: true });
      });

    } else if (id === 'gym') {
      b(2.6, 1.2, 5.5, M.dark, -W / 2 + 2, 0, -D / 2 + 3.5);
      b(2.6, 3.4, 0.5, M.metal, -W / 2 + 2, 1.2, -D / 2 + 1.4);
      b(4.2, 1.5, 1.6, M.dark, W / 2 - 2.6, 0, 0);
      b(0.4, 5, 0.4, M.metal, W / 2 - 1.2, 0, -2.4);
      b(0.4, 5, 0.4, M.metal, W / 2 - 1.2, 0, 1.2);
      b(4.4, 0.35, 0.4, M.metal, W / 2 - 1.2, 4.2, -0.6, { noShadow: true });
      for (var dbi = 0; dbi < 4; dbi++) {
        b(1.5, 0.7, 0.7, M.metal, -1 + dbi * 0.9, 1.2, D / 2 - 1.4, { noShadow: true });
      }
      b(5, 0.12, 3, M.rugDark, 0, 0, D / 2 - 4, { noShadow: true });
      b(0.18, 6.5, D - 3, M.mirror, -W / 2 + 0.45, 1.2, 0, { noShadow: true });
      plant(W / 2 - 1.4, D / 2 - 1.6, 0.9);

    } else if (id === 'travel-room') {
      shelves('n', W - 1.2, 0, 7.5);
      shelves('w', D - 4, -1, 7.5);
      b(4, 2.4, 2, M.woodDark, 0.6, 0, D / 2 - 2.4);
      b(1.5, 1.6, 1.5, M.fabric, 0.6, 0, D / 2 - 4.2);
      b(3.2, 2.2, 0.18, M.art, W / 2 - 0.5, 4.4, 0.5, { noShadow: true });
      lamp(2, D / 2 - 2.4, 2.4);
      plant(-W / 2 + 1.2, D / 2 - 1.4, 0.7);

    } else if (/bath|powder/.test(id)) {
      var long = W >= D;
      b(long ? 5 : 2.6, 1.9, long ? 2.6 : 5, M.linen,
        long ? -W / 2 + 3.2 : 0, 0, long ? 0 : -D / 2 + 3.2);
      b(long ? 4.4 : 2, 2.6, long ? 2 : 4.4, M.woodDark,
        long ? W / 2 - 2.8 : 0, 0, long ? -D / 2 + 1.3 : D / 2 - 2.8);
      b(long ? 4.4 : 2.2, 0.25, long ? 2.2 : 4.4, M.marble,
        long ? W / 2 - 2.8 : 0, 2.6, long ? -D / 2 + 1.3 : D / 2 - 2.8,
        { noShadow: true });
      b(long ? 3.6 : 0.15, 3, long ? 0.15 : 3.6, M.mirror,
        long ? W / 2 - 2.8 : 0, 3.4,
        long ? -D / 2 + 0.45 : D / 2 - 0.45, { noShadow: true });
      if (W * D > 90) {
        b(0.15, 7, Math.min(4, D - 2), M.glass, W / 2 - 3.6, 0, D / 2 - 2.6,
          { noShadow: true });
        plant(-W / 2 + 1.2, D / 2 - 1.2, 0.6);
      }

    } else if (id === 'master-wardrobe') {
      shelves('n', W - 1.2, 0, 7.4);
      shelves('s', W - 1.2, 0, 7.4);
      b(W * 0.45, 2.6, 2.2, M.woodDark, 0, 0, 0);
      b(W * 0.47, 0.22, 2.4, M.marble, 0, 2.6, 0, { noShadow: true });
      b(0.15, 5.5, 2.4, M.mirror, -W / 2 + 0.5, 1, 0, { noShadow: true });

    } else if (id === 'foyer') {
      b(4.5, 2.6, 1.3, M.woodDark, 0, 0, -D / 2 + 0.9);
      b(3.4, 4, 0.15, M.mirror, 0, 3.2, -D / 2 + 0.5, { noShadow: true });
      b(3, 1.4, 1.3, M.fabric, W / 2 - 2.4, 0, D / 2 - 1.1);
      plant(-W / 2 + 1.4, D / 2 - 1.4, 1.1);
      rug(5, Math.min(6, D - 2), M.rug, 0, 0.5);
      pendant(0, 0, 4.5);

    } else if (id === 'prayer') {
      b(3.4, 3.6, 1.2, M.woodDark, 0, 0, -D / 2 + 0.9);
      b(2.6, 1.2, 0.5, M.brass, 0, 3.6, -D / 2 + 0.9, { noShadow: true });
      rug(3.6, 4.4, M.rugDark, 0, 0.8);
      lamp(W / 2 - 1.2, -D / 2 + 1.4, 1.4);

    } else if (id === 'rear-verandah') {
      sofa(8, -W / 2 + 6, -1.5, 1);
      b(4, 1.1, 2.4, M.woodDark, -W / 2 + 6, 0, 1.6);
      rug(12, 8, M.rug, -W / 2 + 6, 0.5);
      b(7, 0.35, 3.4, M.woodDark, W / 2 - 7, 2.2, 0, { noShadow: true });
      [-1, 1].forEach(function (k) {
        b(1.4, 1.5, 1.4, M.wood, W / 2 - 7, 0, k * 3);
        b(1.4, 1.5, 1.4, M.wood, W / 2 - 9.4, 0, k * 1.2);
        b(1.4, 1.5, 1.4, M.wood, W / 2 - 4.6, 0, k * 1.2);
      });
      plant(0, -D / 2 + 1.6, 1.3);
      plant(W / 2 - 1.6, D / 2 - 1.8, 1.1);

    } else if (id === 'rear-deck') {
      [-1, 1].forEach(function (k) {
        b(2.4, 1.1, 6, M.linen, k * 9, 0, 0);
        b(2.4, 1.6, 1.4, M.linen, k * 9, 0.9, -2.2, { noShadow: true });
      });
      b(2, 1.2, 2, M.woodDark, 12, 0, 0, { noShadow: true });

    } else if (id === 'parking') {
      b(6, 4.2, 14, M.metal, -5, 0, 0);
      b(6, 4.2, 14, M.stone, 5, 0, 0);

    } else if (id === 'master-terrace') {
      [-1, 1].forEach(function (k) {
        b(2.4, 1.1, 6, M.linen, 7.5, 0, k * 3.2);
      });
      b(1.8, 1.4, 1.8, M.woodDark, 7.5, 0, 0, { noShadow: true });
      plant(-W / 2 + 2, -D / 2 + 2, 1.2);
      plant(W / 2 - 2, D / 2 - 2, 1);

    } else if (id === 'front-garden') {
      b(W - 6, 0.2, D - 5, M.grass, 0, 0.2, 0, { noShadow: true });

    } else if (/verandah|gallery|landing/.test(id)) {
      /* shaded walks get a bench and planting rather than furniture */
      if (W > D) {
        b(4, 1.3, 1.4, M.wood, 0, 0, -D / 2 + 1);
        plant(W / 2 - 1.6, -D / 2 + 1.2, 0.8);
      } else {
        b(1.4, 1.3, 4, M.wood, -W / 2 + 1, 0, 0);
        plant(-W / 2 + 1.2, D / 2 - 1.6, 0.8);
      }
    }

    /* A ceiling for every enclosed room: without one you look straight at the
       underside of the slab above and the room reads as unfinished. */
    if (ENCLOSED[r.kind]) {
      var ch = (r.height || FH) - 0.45;
      var ceilMat = /bedroom|master-lounge|travel-room/.test(id)
        ? M.ceilingWood : M.ceiling;
      var cm = box(wu(W - 0.6), wu(0.25), wu(D - 0.6), ceilMat,
        wx(cx), wu(base + ch), wz(cy));
      cm.castShadow = false;
    }

    /* remembered so the walkthrough can frame the room on its contents */
    if (fw > 0) focusPoints[id] = [fx / fw, fy / fw];
  }

  /* ---------------------------------------------------------- planting */

  /* `shadow` is off for the boundary planting: foliage shadows from low-poly
     canopies add very little and the shadow pass is the single biggest cost
     in the frame. */
  function tree(xf, yf, base, scale, type, shadow) {
    var g = new THREE.Group();
    scale = scale || 1;
    if (type === 'palm') {
      var h = 16 * scale;
      var tr = new THREE.Mesh(
        new THREE.CylinderGeometry(wu(0.35 * scale), wu(0.6 * scale), wu(h), 6),
        M.trunk);
      tr.position.y = wu(h / 2);
      tr.castShadow = !!shadow;
      g.add(tr);
      for (var i = 0; i < 7; i++) {
        var frond = new THREE.Mesh(
          new THREE.ConeGeometry(wu(1.5 * scale), wu(8 * scale), 4),
          i % 2 ? M.leaf : M.leafLight);
        frond.position.y = wu(h);
        frond.rotation.z = Math.PI / 2.1;
        frond.rotation.y = (i / 7) * Math.PI * 2;
        frond.translateY(wu(3.4 * scale));
        frond.castShadow = !!shadow;
        g.add(frond);
      }
    } else if (type === 'shrub') {
      var s = new THREE.Mesh(
        new THREE.IcosahedronGeometry(wu(2.2 * scale), 0), M.leaf);
      s.position.y = wu(1.9 * scale);
      s.castShadow = !!shadow;
      g.add(s);
    } else {
      var th = 9 * scale;
      var t2 = new THREE.Mesh(
        new THREE.CylinderGeometry(wu(0.4 * scale), wu(0.7 * scale), wu(th), 6),
        M.trunk);
      t2.position.y = wu(th / 2);
      t2.castShadow = !!shadow;
      g.add(t2);
      [0, 1, 2].forEach(function (k) {
        var c = new THREE.Mesh(
          new THREE.IcosahedronGeometry(wu((4.4 - k * 0.7) * scale), 0),
          k % 2 ? M.leafLight : M.leaf);
        c.position.set(wu((k - 1) * 1.8 * scale), wu(th + k * 1.5 * scale),
          wu((k - 1) * 1.4 * scale));
        c.castShadow = !!shadow;
        g.add(c);
      });
    }
    g.position.set(wx(xf), 0, wz(yf));
    g.position.y = wu(base);
    root.plants.add(g);
    return g;
  }

  function buildPlanting() {
    V.plants.forEach(function (p) {
      tree(p.x, p.y, 0, p.scale, p.type, false);
    });
  }

  /* --------------------------------------------------------------- site */

  function buildSite() {
    var g = new THREE.Mesh(
      new THREE.PlaneGeometry(wu(V.plot.w * 3), wu(V.plot.d * 3)),
      mat(0x3f6033, { rough: 1 }));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -0.02;
    g.receiveShadow = true;
    scene.add(g);

    /* the north road */
    var road = box(wu(V.plot.w * 3), wu(0.4), wu(22), mat(0x2f3134, { rough: 1 }),
      0, wu(0.1), wz(-13));
    road.castShadow = false;

    /* Boundary wall: low along the road so the house and its planting are
       part of the street view, full height on the sides and rear for privacy. */
    var t = 0.8;
    [[0, 0, V.plot.w, t, 3.2], [0, V.plot.d - t, V.plot.w, t, 6.5],
     [0, 0, t, V.plot.d, 6.5], [V.plot.w - t, 0, t, V.plot.d, 6.5]
    ].forEach(function (r) {
      var h = r[4];
      var m = box(wu(r[2]), wu(h), wu(r[3]), M.stone,
        wx(r[0] + r[2] / 2), wu(h / 2), wz(r[1] + r[3] / 2));
      m.receiveShadow = true;
    });

    /* gate piers, so the entrance still reads as an entrance */
    var gate = V.byId('main-gate');
    [gate.rect[0] - 0.6, gate.rect[0] + gate.rect[2] + 0.6].forEach(function (px) {
      box(wu(1.6), wu(7), wu(1.6), M.stone, wx(px), wu(3.5), wz(gate.rect[1] + 0.4));
    });
  }

  /* ------------------------------------------------------------- lights */

  function buildLights() {
    /* A warm neutral bounce colour rather than a saturated green one: a strong
       green ground term tints every downward-facing surface and the whole
       interior reads as a greenhouse. */
    var hemi = new THREE.HemisphereLight(0xcfe2ee, 0x8a7f6b, 0.55);
    scene.add(hemi);

    /* a little ambient so interiors never crush to black */
    scene.add(new THREE.AmbientLight(0xffffff, 0.22));

    /* cool fill from the opposite side keeps shaded faces readable */
    var fill = new THREE.DirectionalLight(0xbcd4e6, 0.45);
    fill.position.set(wu(-50), wu(40), wu(-30));
    scene.add(fill);
    lights.fill = fill;

    var sun = new THREE.DirectionalLight(0xfff0d4, 1.45);
    sun.position.set(wu(60), wu(90), wu(40));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    var s = wu(70);
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = wu(320);
    sun.shadow.bias = -0.0009;
    scene.add(sun);
    scene.add(sun.target);

    lights.day = { hemi: hemi, sun: sun, fill: fill };
    lights.ambient = scene.children.filter(function (o) {
      return o.isAmbientLight;
    })[0];

    /* warm architectural lighting for the night scene */
    var night = new THREE.Group();
    night.visible = false;
    var spots = [
      ['courtyard', 9], ['main-pool', 6], ['rear-verandah', 10],
      ['foyer', 10], ['front-garden', 8], ['pool-gazebo', 9],
      ['well', 6], ['fruit-garden', 8], ['master-terrace', FH + 8],
      ['plunge-pool', FH + 5], ['entry-path', 8], ['parking', 9]
    ];
    spots.forEach(function (sp) {
      var r = V.byId(sp[0]);
      if (!r) return;
      var c = V.centre(r);
      /* pools of warm light rather than a flood: the brief asks for a night
         view that feels like a private resort, not a lit car park */
      var p = new THREE.PointLight(0xffc98a, 0.9, wu(32), 2);
      p.position.set(wx(c[0]), wu(sp[1]), wz(c[1]));
      night.add(p);
    });
    var moon = new THREE.HemisphereLight(0x33506e, 0x0e1a12, 0.25);
    night.add(moon);
    scene.add(night);
    lights.night = night;
  }

  function applyTheme(theme) {
    state.theme = theme;
    var day = theme !== 'night';
    lights.day.hemi.intensity = day ? 0.5 : 0.08;
    lights.day.sun.intensity = day ? 1.45 : 0.05;
    lights.day.fill.intensity = day ? 0.38 : 0.12;
    lights.day.sun.castShadow = day;
    if (lights.ambient) lights.ambient.intensity = day ? 0.16 : 0.06;
    lights.night.visible = !day;
    scene.background = new THREE.Color(day ? 0x8fc0dc : 0x0a0f17);
    /* fog only bites well beyond the plot, so interiors stay crisp and only
       the boundary planting softens into the distance */
    scene.fog = new THREE.Fog(day ? 0xb4d4e4 : 0x0a0f17, wu(190), wu(560));
    renderer.toneMappingExposure = day ? 0.84 : 0.95;
    M.screen.emissiveIntensity = day ? 0.5 : 1.6;
  }

  /* ----------------------------------------------------------- collision */

  function slide(fromX, fromY, toX, toY) {
    var x = toX, y = toY;
    for (var pass = 0; pass < 3; pass++) {
      var moved = false;
      for (var i = 0; i < solids.length; i++) {
        var s = solids[i];
        if (s.floor !== state.floor) continue;
        var dx = s.x2 - s.x1, dy = s.y2 - s.y1;
        var len2 = dx * dx + dy * dy;
        var t = len2 ? Math.max(0, Math.min(1,
          ((x - s.x1) * dx + (y - s.y1) * dy) / len2)) : 0;
        var px = s.x1 + t * dx, py = s.y1 + t * dy;
        var ox = x - px, oy = y - py;
        var d = Math.hypot(ox, oy);
        var need = RADIUS + WALL_T / 2;
        if (d < need && d > 0.0001) {
          x = px + (ox / d) * need;
          y = py + (oy / d) * need;
          moved = true;
        } else if (d <= 0.0001) {
          x = fromX; y = fromY; moved = true;
        }
      }
      if (!moved) break;
    }
    /* Keep the player on the plot, but allow stepping back across the road:
       the front elevation cannot be seen whole from inside an 18 ft setback. */
    x = Math.max(1.5, Math.min(V.plot.w - 1.5, x));
    y = Math.max(-26, Math.min(V.plot.d - 1.5, y));
    return [x, y];
  }

  function roomAt(xf, yf, floor) {
    var best = null;
    V.rooms.forEach(function (r) {
      if (r.floor !== floor && r.floor !== 'site') return;
      if (xf >= r.rect[0] && xf < r.rect[0] + r.rect[2] &&
          yf >= r.rect[1] && yf < r.rect[1] + r.rect[3]) {
        if (!best || ENCLOSED[r.kind] || r.kind === 'water') best = r;
      }
    });
    return best;
  }

  /* ------------------------------------------------------------- build */

  function buildWorld() {
    buildMaterials();
    root.house = new THREE.Group();
    root.plants = new THREE.Group();
    scene.add(root.house);
    scene.add(root.plants);

    buildSite();
    buildSlabs('site', 0);
    buildSlabs('ground', 0);
    buildWalls('ground', 0);
    buildSlabs('first', FH);
    buildWalls('first', FH);
    buildRoof();
    buildPlanting();
    buildLights();
    applyTheme(document.documentElement.getAttribute('data-theme') || 'day');
  }

  /* -------------------------------------------------------------- input */

  function bindInput() {
    var canvas = renderer.domElement;

    document.addEventListener('keydown', function (e) {
      if (!state.open) return;
      keys[e.code] = true;
      if (e.code === 'Escape') close();
      if (/^(KeyW|KeyA|KeyS|KeyD|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Space)$/.test(e.code)) {
        e.preventDefault();
      }
    });
    document.addEventListener('keyup', function (e) { keys[e.code] = false; });

    /* desktop: pointer lock look */
    canvas.addEventListener('click', function () {
      if (document.body.getAttribute('data-touch') === 'true') return;
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      } else {
        pickUnderCrosshair();
      }
    });

    document.addEventListener('mousemove', function (e) {
      if (document.pointerLockElement !== canvas) return;
      state.yaw -= e.movementX * 0.0022;
      state.pitch -= e.movementY * 0.0022;
      clampPitch();
    });

    /* touch: drag anywhere (outside the stick) to look */
    var lastTouch = null, touchMoved = 0;
    canvas.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      lastTouch = { x: e.clientX, y: e.clientY, id: e.pointerId };
      touchMoved = 0;
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!lastTouch || e.pointerId !== lastTouch.id) return;
      var dx = e.clientX - lastTouch.x, dy = e.clientY - lastTouch.y;
      touchMoved += Math.abs(dx) + Math.abs(dy);
      state.yaw -= dx * 0.005;
      state.pitch -= dy * 0.005;
      clampPitch();
      lastTouch.x = e.clientX;
      lastTouch.y = e.clientY;
    });
    canvas.addEventListener('pointerup', function (e) {
      if (lastTouch && e.pointerId === lastTouch.id) {
        if (touchMoved < 8) pickAt(e.clientX, e.clientY);
        lastTouch = null;
      }
    });

    bindStick();
    window.addEventListener('resize', resize);
  }

  function clampPitch() {
    var lim = Math.PI / 2 - 0.12;
    state.pitch = Math.max(-lim, Math.min(lim, state.pitch));
  }

  function bindStick() {
    var stick = dom.stick, knob = dom.knob;
    var active = null, cx = 0, cy = 0, R = 46;

    function start(e) {
      var r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      active = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      move(e);
      e.preventDefault();
    }
    function move(e) {
      if (active !== e.pointerId) return;
      var dx = e.clientX - cx, dy = e.clientY - cy;
      var d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      state.vx = dx / R;
      state.vy = dy / R;
    }
    function end(e) {
      if (active !== e.pointerId) return;
      active = null;
      knob.style.transform = '';
      state.vx = state.vy = 0;
    }
    stick.addEventListener('pointerdown', start);
    stick.addEventListener('pointermove', move);
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
  }

  var ray = null;
  function pickUnderCrosshair() { pick(0, 0); }
  function pickAt(clientX, clientY) {
    var r = renderer.domElement.getBoundingClientRect();
    pick(((clientX - r.left) / r.width) * 2 - 1,
      -((clientY - r.top) / r.height) * 2 + 1);
  }
  function pick(nx, ny) {
    if (!ray) ray = new THREE.Raycaster();
    ray.setFromCamera({ x: nx, y: ny }, camera);
    var hits = ray.intersectObjects(pickables, false);
    for (var i = 0; i < hits.length; i++) {
      var id = hits[i].object.userData.roomId;
      if (id && onRoomPick) { onRoomPick(id); return; }
    }
    /* nothing under the cursor: fall back to the room being stood in */
    var here = roomAt(state.x, state.y, state.floor);
    if (here && onRoomPick) onRoomPick(here.id);
  }

  /* ---------------------------------------------------------------- loop */

  var lastRoomId = null, fpsAcc = 0, fpsN = 0;

  function frame() {
    state.raf = requestAnimationFrame(frame);
    var dt = Math.min(0.05, clock.getDelta());

    /* movement */
    var fwd = 0, strafe = 0;
    if (keys.KeyW || keys.ArrowUp) fwd += 1;
    if (keys.KeyS || keys.ArrowDown) fwd -= 1;
    if (keys.KeyA || keys.ArrowLeft) strafe -= 1;
    if (keys.KeyD || keys.ArrowRight) strafe += 1;
    if (state.vx || state.vy) { strafe += state.vx; fwd -= state.vy; }

    var speed = (keys.ShiftLeft || keys.ShiftRight) ? 16 : 8.2; // ft/s
    var mag = Math.hypot(fwd, strafe);
    if (mag > 1) { fwd /= mag; strafe /= mag; }

    if (fwd || strafe) {
      var sin = Math.sin(state.yaw), cos = Math.cos(state.yaw);
      /* yaw 0 faces north (-y); x is east */
      var dx = (-sin * fwd + cos * strafe) * speed * dt;
      var dy = (-cos * fwd - sin * strafe) * speed * dt;
      var np = slide(state.x, state.y, state.x + dx, state.y + dy);
      state.x = np[0];
      state.y = np[1];
      checkStair();
    }

    var base = state.floor === 'first' ? FH : 0;
    camera.position.set(wx(state.x), wu(base + EYE), wz(state.y));
    camera.rotation.set(0, 0, 0);
    camera.rotateY(state.yaw);
    camera.rotateX(state.pitch);

    /* pool ripple */
    var t = clock.elapsedTime;
    waters.forEach(function (m) {
      var pos = m.geometry.attributes.position;
      for (var i = 0; i < pos.count; i++) {
        var px = pos.getX(i), pz = pos.getZ(i);
        pos.setY(i, Math.sin(px * 7 + t * 1.6) * 0.012 +
          Math.cos(pz * 9 - t * 1.1) * 0.010);
      }
      pos.needsUpdate = true;
    });

    /* HUD */
    var here = roomAt(state.x, state.y, state.floor);
    if (here && here.id !== lastRoomId) {
      lastRoomId = here.id;
      dom.roomName.textContent = here.name;
      dom.floorName.textContent =
        (state.floor === 'first' ? 'First floor' : 'Ground floor') +
        ' · ' + V.dimsOf(here);
    }
    if (mini) mini.move(state.x, state.y, state.yaw);

    renderer.render(scene, camera);

    /* drop the pixel ratio if the frame rate cannot hold up */
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 2) {
      var fps = fpsN / fpsAcc;
      if (fps < 26 && state.quality > 0.65) {
        state.quality -= 0.18;
        renderer.setPixelRatio(Math.max(0.65,
          Math.min(2, window.devicePixelRatio) * state.quality));
      }
      fpsAcc = 0; fpsN = 0;
    }
  }

  function checkStair() {
    var s = V.byId('stair');
    var inStair = state.x >= s.rect[0] && state.x < s.rect[0] + s.rect[2] &&
      state.y >= s.rect[1] && state.y < s.rect[1] + s.rect[3];
    if (inStair && !state._onStair) {
      state._onStair = true;
      setFloor(state.floor === 'ground' ? 'first' : 'ground');
    } else if (!inStair) {
      state._onStair = false;
    }
  }

  function setFloor(floor) {
    state.floor = floor;
    if (mini) {
      var fresh = window.Plan.minimap(floor);
      dom.minimap.innerHTML = '';
      dom.minimap.appendChild(fresh.svg);
      mini = fresh;
    }
    dom.floorBtn.textContent = floor === 'first' ? 'First' : 'Ground';
    flash();
  }

  function flash() {
    dom.loading.textContent = '';
    dom.loading.style.background = 'rgba(10,13,16,.85)';
    dom.loading.style.opacity = '1';
    dom.loading.style.display = 'grid';
    setTimeout(function () {
      dom.loading.style.opacity = '0';
      setTimeout(function () { dom.loading.style.display = 'none'; }, 500);
    }, 90);
  }

  function resize() {
    if (!renderer || !state.open) return;
    var w = dom.root.clientWidth, h = dom.root.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* ------------------------------------------------------------- public */

  function init(options) {
    dom = options.dom;
    onRoomPick = options.onRoomPick;

    if (!window.THREE) { showFallback('3D library not found.'); return false; }
    THREE = window.THREE;

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch (e) {
      showFallback('This browser or device could not start WebGL.');
      return false;
    }
    if (!renderer.getContext()) {
      showFallback('WebGL is unavailable on this device.');
      return false;
    }

    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.physicallyCorrectLights = false;
    /* filmic tone mapping stops the bright tropical exteriors clipping to
       white while keeping the shaded interiors open */
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    dom.canvasHost.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(66, 1, 0.08, wu(420));
    camera.rotation.order = 'YXZ';
    clock = new THREE.Clock();

    buildWorld();
    bindInput();

    mini = window.Plan.minimap('ground');
    dom.minimap.appendChild(mini.svg);

    state.ready = true;
    return true;
  }

  function showFallback(msg) {
    if (dom.fallback) {
      dom.fallback.style.display = 'grid';
      dom.fallback.innerHTML =
        '<div><p style="font-family:Georgia,serif;font-size:20px">' +
        'The 3D walkthrough cannot run here</p><p style="opacity:.75">' + msg +
        '</p><p style="opacity:.75">The guided tour and the interactive plans ' +
        'work on every device.</p></div>';
    }
  }

  function open(roomId) {
    if (!state.ready && !init(window.Walk._opts)) return;
    dom.root.setAttribute('data-open', 'true');
    state.open = true;
    document.body.style.overflow = 'hidden';
    resize();
    if (roomId) teleport(roomId, true);
    else teleport('main-gate', true);
    applyTheme(document.documentElement.getAttribute('data-theme') || 'day');
    dom.loading.style.opacity = '0';
    setTimeout(function () { dom.loading.style.display = 'none'; }, 600);
    cancelAnimationFrame(state.raf);
    clock.getDelta();
    frame();
    setTimeout(function () {
      if (dom.hint) dom.hint.style.opacity = '0';
    }, 7000);
  }

  function close() {
    state.open = false;
    dom.root.setAttribute('data-open', 'false');
    document.body.style.overflow = '';
    cancelAnimationFrame(state.raf);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /* Which way out of this room is worth facing?  Probe just beyond each of the
     four walls and score what is there: open space and greenery beat another
     room.  Ties go to the room's longer axis, so you look down its length. */
  function bestOutlook(r) {
    var c = V.centre(r);
    var dirs = [[0, -1], [0, 1], [1, 0], [-1, 0]];
    var score = { open: 4, water: 4, landscape: 4, paving: 3, structure: 3,
      circulation: 2, room: 0 };
    var best = null, bestScore = -1;

    dirs.forEach(function (d) {
      var reach = (d[0] ? r.rect[2] : r.rect[3]) / 2 + 2.5;
      var px = Math.round(c[0] + d[0] * reach);
      var py = Math.round(c[1] + d[1] * reach);
      var beyond = null;
      V.rooms.forEach(function (o) {
        if (o.id === r.id) return;
        if (o.floor !== r.floor && o.floor !== 'site') return;
        if (px >= o.rect[0] && px < o.rect[0] + o.rect[2] &&
            py >= o.rect[1] && py < o.rect[1] + o.rect[3]) {
          if (!beyond || (score[o.kind] || 0) > (score[beyond.kind] || 0)) beyond = o;
        }
      });
      /* off the built area entirely still means daylight and garden */
      var s = beyond ? (score[beyond.kind] || 0) : 3;
      /* prefer looking along the longer dimension */
      s += (d[0] ? r.rect[2] : r.rect[3]) / 100;
      if (s > bestScore) { bestScore = s; best = d; }
    });
    return bestScore > 0 ? best : null;
  }

  /* Put the camera in a room, standing just inside it and looking in. */
  function teleport(roomId, instant) {
    var r = V.byId(roomId);
    if (!r) return;
    if (r.floor === 'first' && state.floor !== 'first') setFloor('first');
    if ((r.floor === 'ground' || r.floor === 'site') && state.floor !== 'ground') {
      setFloor('ground');
    }
    var c = V.centre(r);
    var tx = V.house.x + V.house.w / 2, ty = V.house.y + V.house.d / 2;

    if (roomId === 'main-gate' || roomId === 'entry-path') {
      /* Face south down the entrance axis at the front of the house (yaw 0 is
         north, so the house is at PI).  The arrival view starts out on the
         road, where the whole elevation and its planting are visible; the
         entrance walk starts inside the gate. */
      state.x = c[0];
      state.y = roomId === 'main-gate' ? -21 : Math.max(4, Math.min(c[1], 10));
      state.yaw = Math.PI;
      state.pitch = 0;
      lastRoomId = null;
      if (!instant) flash();
      return;
    }

    /* Look toward the middle of the house, then step back along that line so
       the space is in front of the camera instead of around it - otherwise
       you arrive standing inside the courtyard tree. */
    var dx = tx - c[0], dy = ty - c[1];
    var len = Math.hypot(dx, dy);
    if (len < 5) { dx = 0; dy = -1; len = 1; }      // dead centre: face north
    dx /= len; dy /= len;

    /* In a furnished room, stand back in a corner and look diagonally across
       it, so you arrive seeing the room itself - bed, seating, joinery - and
       not an empty stretch of floor.  furnish() puts the main pieces against
       the north wall, so the view runs south-west to north-east. */
    /* Some rooms are about a view along an axis rather than about furniture -
       the foyer exists to line up on the courtyard.  [?1049h[22;0;0t[>4;2m[?1h=[?2004h[?1004h[1;24r[?12h[?12l[22;2t[22;1t[27m[23m[29m[m[H[2J[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?25l[2;1H[94m~                                                                               [3;1H~                                                                               [4;1H~                                                                               [5;1H~                                                                               [6;1H~                                                                               [7;1H~                                                                               [8;1H~                                                                               [9;1H~                                                                               [10;1H~                                                                               [11;1H~                                                                               [12;1H~                                                                               [13;1H~                                                                               [14;1H~                                                                               [15;1H~                                                                               [16;1H~                                                                               [17;1H~                                                                               [18;1H~                                                                               [19;1H~                                                                               [20;1H~                                                                               [21;1H~                                                                               [22;1H~                                                                               [m[23;1H[1m[7m[No Name][RO] [unix] (05:29 01/01/1970)                                0,0-1 All[m[6;32HVIM - Vi IMproved[8;33Hversion 9.0.1403[9;29Hby Bram Moolenaar et al.[10;19HVim is open source and freely distributable[12;26HHelp poor children in Uganda![13;18Htype  :help iccf[34m<Enter>[m       for information [15;18Htype  :q[34m<Enter>[m               to exit         [16;18Htype  :help[34m<Enter>[m  or  [34m<F1>[m  for on-line help[17;18Htype  :help version9[34m<Enter>[m   for version info[1;1H[?25h[?4m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[?2004l[>4;m[?2004h[>4;2m[24;1H[?2004l[>4;m[?1004l[?2004l[?1l>[?1049l[23;0;0t[>4;mVim: Error reading input, exiting...
Vim: Finished.
[24;1H[23;2t[23;1t[J states that. */
    if (r.view) {
      var vmap = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
      var vd = vmap[r.view] || [0, -1];
      var half = vd[0] ? r.rect[2] / 2 : r.rect[3] / 2;
      var stand = Math.max(0, half - (RADIUS + 1.2));
      state.x = c[0] - vd[0] * stand;
      state.y = c[1] - vd[1] * stand;
      state.yaw = Math.atan2(-vd[0], -vd[1]);
      state.pitch = 0;
      lastRoomId = null;
      if (!instant) flash();
      return;
    }

    if (r.kind === 'room') {
      /* Frame the room on its own contents: stand back from where the
         furniture actually is and look at it, so you arrive seeing the bed,
         the seating or the joinery rather than a blank stretch of wall. */
      var f = focusPoints[r.id] || [c[0], c[1] - r.rect[3] * 0.3];
      var tX = f[0], tY = f[1];
      var vx = tX - c[0], vy = tY - c[1];
      var vlen = Math.hypot(vx, vy);
      if (vlen < 1.2) { vx = 0; vy = -1; vlen = 1; }   // centred: view from the south
      vx /= vlen; vy /= vlen;

      var dist = Math.min(Math.max(6.5, V.areaOf(r) * 0.045), 15);
      var px = tX - vx * dist, py = tY - vy * dist;

      /* keep the viewpoint inside the room */
      var m = RADIUS + 1.1;
      px = Math.max(r.rect[0] + m, Math.min(r.rect[0] + r.rect[2] - m, px));
      py = Math.max(r.rect[1] + m, Math.min(r.rect[1] + r.rect[3] - m, py));

      state.x = px; state.y = py;
      state.yaw = Math.atan2(-(tX - px), -(tY - py));
      state.pitch = 0;
      lastRoomId = null;
      if (!instant) flash();
      return;
    }

    var back = Math.min(Math.min(r.rect[2], r.rect[3]) * 0.38, 9);
    /* a pool is looked at from its edge, not swum in */
    if (r.kind === 'water') back = Math.max(r.rect[3] / 2 + 4, back);

    state.x = c[0] - dx * back;
    state.y = c[1] - dy * back;
    state.yaw = Math.atan2(-dx, -dy);
    state.pitch = 0;

    /* never arrive embedded in a wall */
    var fixed = slide(c[0], c[1], state.x, state.y);
    state.x = fixed[0];
    state.y = fixed[1];
    if (!instant) flash();
    lastRoomId = null;
  }

  window.Walk = {
    init: function (o) { window.Walk._opts = o; return init(o); },
    open: open,
    close: close,
    teleport: teleport,
    setFloor: setFloor,
    isOpen: function () { return state.open; },
    applyTheme: function (t) { if (state.ready) applyTheme(t); },
    currentFloor: function () { return state.floor; },
    resize: resize,
    /* handles for inspecting the generated model from the console */
    debug: function () {
      return { scene: scene, camera: camera, renderer: renderer,
        solids: solids, state: state, THREE: THREE };
    }
  };
})();
