(() => {
  // ------------------------------------------------------------
  //  Rubik-style cube with orbiting image-particles (p5.js WEBGL)
  //  — now with particle visibility toggle + click-to-scale
  // ------------------------------------------------------------

  // --- Constants -----------------------------------------------------------
  const EDGE       = 60;
  const GAP        = 2;
  const TURN_SPEED = 6;
  const STICKER = {
    U: '#ffff00', D: '#ffffff',
    F: '#00ff00', B: '#0000ff',
    L: '#ff8000', R: '#ff0000'
  };
  const NUM_PARTICLE_IMAGES = 48;   // 48 images – one per particle
  const SCALE_UP_FACTOR     = 4;  // particle scale when “zoomed”

  // --- Globals -------------------------------------------------------------
  let cube;
  let viewX = 25, viewY = -35;
  let dragMode = 'none', dragStart, dragNow;
  let pickAxis, pickLayer, screenBB;
  let video;
  let particles = [];
  let particleImgs = [];

  //  NEW: visibility toggle -----------------------------------------------
  let particlesVisible = false;     // start hidden
  let toggleBtn;                    // DOM button element

  // -------------------------------------------------------------------------
  //  p5 lifecycle callbacks (attached to window so p5 can find them)
  // -------------------------------------------------------------------------
  window.preload = function () {
    /*
      Try to load img1.png … img48.png.
      If a file is missing, create a placeholder graphic so the sketch
      continues without throwing “error” events in the console.
    */
    for (let i = 0; i < NUM_PARTICLE_IMAGES; i++) {
      const path = `images/img${i + 1}.png`;
      particleImgs[i] = loadImage(
        path,
        () => {},   // success: nothing extra to do
        () => {     // failure: build a placeholder image
          const pg = createGraphics(EDGE, EDGE);
          pg.noStroke();
          pg.background(random(60, 255), random(60, 255), random(60, 255));
          pg.fill(0);
          pg.textAlign(CENTER, CENTER);
          pg.textSize(EDGE * 0.4);
          pg.text(i + 1, EDGE * 0.5, EDGE * 0.55);
          particleImgs[i] = pg;
        }
      );
    }
  };

  window.setup = function () {
    createCanvas(windowWidth, windowHeight, WEBGL);
    angleMode(DEGREES);

    cube = new RubiksCube();

    video = createCapture(VIDEO);
    video.size(width, height);
    video.hide();

    particles = generateParticles();

    // ---- NEW: UI button ---------------------------------------------------
    toggleBtn = createButton('Show Particles');
    toggleBtn.position(10, 10);
    toggleBtn.style('padding', '6px 12px');
    toggleBtn.mousePressed(() => {
      particlesVisible = !particlesVisible;
      toggleBtn.html(particlesVisible ? 'Hide Particles' : 'Show Particles');
    });
  };

  window.windowResized = function () {
    resizeCanvas(windowWidth, windowHeight);
    if (video) video.size(width, height);
  };

  window.draw = function () {
    background(0);

    // ---- live-video background -------------------------------------------
    push();
    resetMatrix();
    translate(-width / 2, -height / 2, -500);
    imageMode(CORNER);

    const videoRatio  = video.width / video.height;
    const canvasRatio = width / height;
    let drawW, drawH;

    if (canvasRatio > videoRatio) {
      drawW = width;
      drawH = width / videoRatio;
    } else {
      drawH = height;
      drawW = height * videoRatio;
    }

    const scaleFactor = 4;
    drawW *= scaleFactor;
    drawH *= scaleFactor;

    image(video, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
    pop();

    // ---- cube + particles -------------------------------------------------
    push();
    applyAspectScale();
    ambientLight(150);
    directionalLight(255, 255, 255, 0.5, 1, 0);
    rotateX(viewX);
    rotateY(viewY);

    cube.update();
    cube.show();

    for (let p of particles) {
      p.update();
      if (particlesVisible) p.show();   // draw only if visible
    }

    screenBB = projectCubeBounds();
    pop();
  };

  // --- Mouse interaction ---------------------------------------------------
  window.mousePressed = function () {
    // 1) First, see if a particle was clicked (only when visible)
    if (particlesVisible) {
      for (let p of particles) {
        if (p.isMouseOver(mouseX, mouseY)) {
          p.toggleScale();
          return;                        // don’t start drag / cube turn
        }
      }
    }

    // 2) Otherwise, start normal cube interaction
    dragStart = createVector(mouseX, mouseY);
    dragNow   = dragStart.copy();

    if (insideBB(mouseX, mouseY)) {
      const face = pickFaceUnderMouse(mouseX, mouseY);
      if (face) {
        pickAxis  = face.axis;
        pickLayer = face.layer;
        dragMode  = 'face';
      } else dragMode = 'orbit';
    } else dragMode = 'orbit';
  };

  window.mouseDragged = function () {
    dragNow.set(mouseX, mouseY);
    if (dragMode === 'orbit' && !cube.isTurning()) {
      viewY += (mouseX - pmouseX) * 0.5;
      viewX += (mouseY - pmouseY) * 0.5;
    }
  };

  window.mouseReleased = function () {
    if (dragMode === 'face' && !cube.isTurning()) {
      const d  = p5.Vector.sub(dragNow, dragStart);
      const dx = d.x, dy = d.y;
      let dir  = 0;

      if      (pickAxis === 'z')
        dir = (abs(dx) > abs(dy) ? (dx > 0 ?  1 : -1)
                                 : (dy > 0 ? -1 :  1)) * (pickLayer === 1 ? 1 : -1);
      else if (pickAxis === 'x')
        dir = (abs(dy) > abs(dx) ? (dy > 0 ?  1 : -1)
                                 : (dx > 0 ? -1 :  1)) * (pickLayer === 1 ? 1 : -1);
      else
        dir = (abs(dx) > abs(dy) ? (dx > 0 ?  1 : -1)
                                 : (dy > 0 ?  1 : -1)) * (pickLayer === 1 ? 1 : -1);

      if (dir !== 0) cube.startTurn(pickAxis, pickLayer, dir);
    }
    dragMode = 'none';
  };

  // -------------------------------------------------------------------------
  //  Utility functions
  // -------------------------------------------------------------------------
  function applyAspectScale () {
    const s = min(width, height) / 720;
    scale(s);
  }

  function insideBB (x, y) {
    return x > screenBB.minX && x < screenBB.maxX &&
           y > screenBB.minY && y < screenBB.maxY;
  }

  function pickFaceUnderMouse (mx, my) {
    const faces = [
      { axis: 'x', layer:  1, coord: createVector( 1, 0, 0) },
      { axis: 'x', layer: -1, coord: createVector(-1, 0, 0) },
      { axis: 'y', layer:  1, coord: createVector( 0, 1, 0) },
      { axis: 'y', layer: -1, coord: createVector( 0,-1, 0) },
      { axis: 'z', layer:  1, coord: createVector( 0, 0, 1) },
      { axis: 'z', layer: -1, coord: createVector( 0, 0,-1) },
    ];

    let best = null, bestD = 1e9, bestZ = 1e9;
    push();
    applyAspectScale();
    rotateX(viewX);
    rotateY(viewY);
    for (let f of faces) {
      const p  = screenPosition(
                   f.coord.x * (EDGE + GAP),
                   f.coord.y * (EDGE + GAP),
                   f.coord.z * (EDGE + GAP)
                 );
      const dz = f.coord.z * (EDGE + GAP);
      const d2 = sq(mx - p.x) + sq(my - p.y);
      if (d2 < bestD || (abs(d2 - bestD) < 0.5 && dz < bestZ)) {
        bestD = d2; best = f; bestZ = dz;
      }
    }
    pop();

    if (sqrt(bestD) < EDGE * 1.1) return best;
    return null;
  }

  function projectCubeBounds () {
    const R   = EDGE + GAP;
    const pts = [
      createVector(-R,-R,-R), createVector(R,-R,-R),
      createVector(-R, R,-R), createVector(R, R,-R),
      createVector(-R,-R, R), createVector(R,-R, R),
      createVector(-R, R, R), createVector(R, R, R)
    ];
    let mnX = 1e9, mxX = -1e9, mnY = 1e9, mxY = -1e9;
    push();
    applyAspectScale();
    rotateX(viewX);
    rotateY(viewY);
    for (let v of pts) {
      const s = screenPosition(v);
      mnX = min(mnX, s.x); mxX = max(mxX, s.x);
      mnY = min(mnY, s.y); mxY = max(mxY, s.y);
    }
    pop();
    return { minX: mnX, maxX: mxX, minY: mnY, maxY: mxY };
  }

  function screenPosition (x, y, z = 0) {
    const v  = x instanceof p5.Vector ? x : createVector(x, y, z);
    const mv = _renderer.uMVMatrix.mat4;
    const pm = _renderer.uPMatrix.mat4;

    const wx = mv[0]*v.x + mv[4]*v.y + mv[ 8]*v.z + mv[12],
          wy = mv[1]*v.x + mv[5]*v.y + mv[ 9]*v.z + mv[13],
          wz = mv[2]*v.x + mv[6]*v.y + mv[10]*v.z + mv[14],
          ww = mv[3]*v.x + mv[7]*v.y + mv[11]*v.z + mv[15];

    let sx = pm[0]*wx + pm[4]*wy + pm[ 8]*wz + pm[12]*ww,
        sy = pm[1]*wx + pm[5]*wy + pm[ 9]*wz + pm[13]*ww,
        sw = pm[3]*wx + pm[7]*wy + pm[11]*wz + pm[15]*ww;

    if (sw !== 0) { sx /= sw; sy /= sw; }
    return createVector((sx + 1) * width / 2,
                        (1 - sy) * height / 2);
  }

  function rotateVector (v, deg, axis) {
    const rad = radians(deg);
    const c = cos(rad), s = sin(rad);
    const { x, y, z } = v;
    if (axis === 'x') return createVector(x, y * c - z * s, y * s + z * c);
    if (axis === 'y') return createVector(x * c + z * s, y, -x * s + z * c);
    return createVector(x * c - y * s, x * s + y * c, z);
  }

  // -------------------------------------------------------------------------
  //  Particle with image texture
  // -------------------------------------------------------------------------
  class Particle {
    constructor (cubie, faceNormal, color, img) {
      this.cubie  = cubie;
      this.normal = faceNormal.copy().normalize();
      this.color  = color;
      this.img    = img;

      this.orbitRadius = EDGE * 0.8;
      this.angle       = random(360);
      this.speed       = random(0.5, 1.5);
      this.size        = EDGE;

      // NEW: dynamic scale (1 or 1.5)
      this.scaleFactor = 1.0;

      this.stickerPos = this.normal.copy().mult(EDGE / 2 + GAP / 2);
      this.pos        = createVector();
    }

    update () {
      this.angle += this.speed;
      if (this.angle >= 360) this.angle -= 360;

      const cubie = this.cubie;
      let basePos = createVector(
        cubie.pos.x * (EDGE + GAP),
        cubie.pos.y * (EDGE + GAP),
        cubie.pos.z * (EDGE + GAP)
      );

      if (cube.turning && cubie.pos[cube.axis] === cube.layer) {
        basePos = rotateVector(basePos, cube.deg * cube.dir, cube.axis);
      }

      let n  = this.normal.copy();
      let sp = this.stickerPos.copy();
      if (cube.turning && cubie.pos[cube.axis] === cube.layer) {
        n  = rotateVector(n,  cube.deg * cube.dir, cube.axis);
        sp = rotateVector(sp, cube.deg * cube.dir, cube.axis);
      }

      const outwardPush = 140;

      let tangent;
      if (abs(n.x) < 0.9) tangent = createVector(1, 0, 0);
      else                tangent = createVector(0, 1, 0);
      const binormal = n.cross(tangent).normalize();
      tangent        = binormal.cross(n).normalize();

      const rad         = radians(this.angle);
      const orbitOffset = p5.Vector.add(
                            p5.Vector.mult(tangent , cos(rad) * this.orbitRadius),
                            p5.Vector.mult(binormal, sin(rad) * this.orbitRadius)
                          );

      this.pos = p5.Vector.add(basePos, sp)
                   .add(p5.Vector.mult(n, outwardPush))
                   .add(orbitOffset);
    }

    show () {
      push();
      translate(this.pos.x, this.pos.y, this.pos.z);

      const n = this.normal;
      let angle = degrees(acos(n.z));
      let axis  = createVector(-n.y, n.x, 0);
      if (axis.mag() < 0.001) axis = createVector(1, 0, 0);

      rotate(angle, axis);

      noStroke();
      if (this.img) texture(this.img);
      plane(this.size * this.scaleFactor, this.size * this.scaleFactor);
      pop();
    }

    // ---- NEW: interaction helpers ----------------------------------------
    toggleScale () {
      this.scaleFactor = (this.scaleFactor === 1) ? SCALE_UP_FACTOR : 1;
    }

    isMouseOver (mx, my) {
      const sp = screenPosition(this.pos);
      const d2 = sq(mx - sp.x) + sq(my - sp.y);

      // Estimate on-screen radius (takes global scale into account)
      const s  = min(width, height) / 720;
      const r  = (this.size * this.scaleFactor * s) / 2;

      return d2 < r * r;
    }
  }

  // -------------------------------------------------------------------------
  //  Cubie (single little cube) and RubiksCube (whole cube)
  // -------------------------------------------------------------------------
  class Cubie {
    constructor (pos, cols) {
      this.pos  = { ...pos };
      this.cols = { ...cols };
    }

    rotateStickers (axis, d) {
      const C = this.cols;
      if      (axis === 'x')
        [C.U, C.F, C.D, C.B] = d > 0 ? [C.F, C.D, C.B, C.U]
                                     : [C.B, C.U, C.F, C.D];
      else if (axis === 'y')
        [C.F, C.R, C.B, C.L] = d > 0 ? [C.L, C.F, C.R, C.B]
                                     : [C.R, C.B, C.L, C.F];
      else
        [C.U, C.R, C.D, C.L] = d > 0 ? [C.L, C.U, C.R, C.D]
                                     : [C.R, C.D, C.L, C.U];
    }

    drawAt (p) {
      push();
      translate(p.x * (EDGE + GAP),
                p.y * (EDGE + GAP),
                p.z * (EDGE + GAP));

      noStroke();
      const faces = [
        ['y',  1, this.cols.U], ['y', -1, this.cols.D],
        ['z',  1, this.cols.F], ['z', -1, this.cols.B],
        ['x', -1, this.cols.L], ['x',  1, this.cols.R]
      ];
      for (const [axis, sign, col] of faces) {
        if (!col) continue;
        drawStickerBox(axis, sign, col);
      }
      stroke(0); strokeWeight(2); noFill();
      box(EDGE);
      pop();

      function drawStickerBox (axis, sign, col) {
        push();
        ambientMaterial(col);
        noStroke();
        if      (axis === 'x') rotateY(sign > 0 ?  90 : -90);
        else if (axis === 'y') rotateX(sign > 0 ? -90 :  90);
        else if (axis === 'z' && sign < 0) rotateY(180);
        translate(0, 0, EDGE / 2 + 1);
        box(EDGE, EDGE, 2);
        pop();
      }
    }
  }

  class RubiksCube {
    constructor () {
      this.cubies = [];
      for (let x = -1; x <= 1; x++)
        for (let y = -1; y <= 1; y++)
          for (let z = -1; z <= 1; z++) {
            const cols = { ...STICKER };
            this.cubies.push(new Cubie({ x, y, z }, cols));
          }
      this.turning = false;
      this.axis    = 'z';
      this.layer   =  1;
      this.dir     =  1;
      this.deg     =  0;
    }

    isTurning () { return this.turning; }

    startTurn (a, l, d) {
      if (this.turning) return;
      this.axis  = a;
      this.layer = l;
      this.dir   = d;
      this.deg   = 0;
      this.turning = true;
    }

    update () {
      if (!this.turning) return;
      this.deg += TURN_SPEED;
      if (this.deg >= 90) {
        this.deg = 90;
        this.turning = false;
        for (let c of this.cubies) {
          if (c.pos[this.axis] === this.layer)
            rotateCubie(c, this.axis, this.dir);
        }
      }
    }

    show () {
      for (let c of this.cubies) {
        if (this.turning && c.pos[this.axis] === this.layer) {
          push();
          if      (this.axis === 'x') rotateX(this.deg * this.dir);
          else if (this.axis === 'y') rotateY(this.deg * this.dir);
          else if (this.axis === 'z') rotateZ(this.deg * this.dir);
          c.drawAt(c.pos);
          pop();
        } else c.drawAt(c.pos);
      }
    }
  }

  function rotateCubie (c, axis, dir) {
    let x = c.pos.x, y = c.pos.y, z = c.pos.z;
    if      (axis === 'x') {
      const ny = dir > 0 ? -z : z;
      const nz = dir > 0 ?  y : -y;
      c.pos.y = ny; c.pos.z = nz;
    } else if (axis === 'y') {
      const nx = dir > 0 ?  z : -z;
      const nz = dir > 0 ? -x :  x;
      c.pos.x = nx; c.pos.z = nz;
    } else {
      const nx = dir > 0 ? -y :  y;
      const ny = dir > 0 ?  x : -x;
      c.pos.x = nx; c.pos.y = ny;
    }
    c.rotateStickers(axis, dir);
  }

  // -------------------------------------------------------------------------
  //  Particle generation
  // -------------------------------------------------------------------------
  function generateParticles () {
    const parts = [];
    const faces = [
      { axis: 'x', layer:  1, color: STICKER.R, normal: createVector( 1, 0, 0) },
      { axis: 'x', layer: -1, color: STICKER.L, normal: createVector(-1, 0, 0) },
      { axis: 'y', layer:  1, color: STICKER.U, normal: createVector( 0, 1, 0) },
      { axis: 'y', layer: -1, color: STICKER.D, normal: createVector( 0,-1, 0) },
      { axis: 'z', layer:  1, color: STICKER.F, normal: createVector( 0, 0, 1) },
      { axis: 'z', layer: -1, color: STICKER.B, normal: createVector( 0, 0,-1) },
    ];

    let imgIndex = 0;
    for (const c of cube.cubies) {
      for (const f of faces) {
        if (c.pos[f.axis] === f.layer) {
          const img = particleImgs[imgIndex % particleImgs.length] || null;
          parts.push(new Particle(c, f.normal, f.color, img));
          imgIndex++;
        }
        if (parts.length >= NUM_PARTICLE_IMAGES) break;
      }
      if (parts.length >= NUM_PARTICLE_IMAGES) break;
    }
    return parts;
  }
})();
