import { ShowcaseExample } from './types';

export const polygonSlicingExample: ShowcaseExample = {
  id: 'polygon-slicing',
  title: 'Polygon Slicing',
  description: 'Drag across the shape to slice it into pieces',
  category: 'basic',
  thumbnail: '/assets/polygon-slicing-thumbnail.png',
  useDarkCanvas: true,
  code: `// Drag a line across the polygon to split it.
// Pieces stay on the canvas, so they can be sliced again.

import { init } from '@thorvg/webcanvas';

const TVG = await init({
  renderer: 'gl',
  locateFile: (path) => '/webcanvas/' + path.split('/').pop()
});

const SIZE = 600;
const canvas = new TVG.Canvas('#canvas', {
  width: SIZE,
  height: SIZE,
});

const MIN_AREA = 60;      //below this a piece is invisible, so don't create it
const DAMPING = 0.97;     //velocity kept per frame
const DRIFT_SPEED = 12;
const DRIFT_STOP = 0.8;

//Sign tells which side of the line ab the point p lies on.
function side(a, b, p) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

//Shoelace formula.
function area(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    sum += p.x * q.y - q.x * p.y;
  }
  return Math.abs(sum) * 0.5;
}

//Keeps only the half-plane on one side of the line ab. (Sutherland-Hodgman)
//Cutting a convex polygon with a line always yields convex pieces,
//so the assumption holds under repeated slicing.
function clipHalf(points, a, b, positive) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const cur = points[i];
    const next = points[(i + 1) % points.length];
    let dCur = side(a, b, cur);
    let dNext = side(a, b, next);
    if (!positive) { dCur = -dCur; dNext = -dNext; }

    if (dCur >= 0) out.push(cur);

    //This edge straddles the line, so interpolate where it crosses.
    if ((dCur > 0 && dNext < 0) || (dCur < 0 && dNext > 0)) {
      const t = dCur / (dCur - dNext);
      out.push({
        x: cur.x + t * (next.x - cur.x),
        y: cur.y + t * (next.y - cur.y),
      });
    }
  }
  return out;
}

function clamp(v) {
  return Math.max(45, Math.min(245, Math.round(v)));
}

function jitter(channel) {
  return clamp(channel + (Math.random() - 0.5) * 44);
}

//Start with a convex pentagon.
const pieces = [];
for (let i = 0; i < 5; i++) {
  const angle = -Math.PI / 2 + i * (Math.PI * 2 / 5);
  if (i === 0) pieces.push({ outline: [], r: 230, g: 200, b: 90, vx: 0, vy: 0 });
  pieces[0].outline.push({
    x: SIZE / 2 + 190 * Math.cos(angle),
    y: SIZE / 2 + 190 * Math.sin(angle),
  });
}

let dragBegin = null;
let dragEnd = null;

const el = document.querySelector('#canvas');

//Map a pointer event to canvas coordinates.
function position(e) {
  const rect = el.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) / rect.width * SIZE,
    y: (e.clientY - rect.top) / rect.height * SIZE,
  };
}

el.addEventListener('pointerdown', (e) => {
  dragBegin = position(e);
  dragEnd = dragBegin;
  el.setPointerCapture(e.pointerId);
});

el.addEventListener('pointermove', (e) => {
  if (dragBegin) dragEnd = position(e);
});

el.addEventListener('pointerup', (e) => {
  if (!dragBegin) return;

  const a = dragBegin;
  const b = position(e);
  dragBegin = null;
  dragEnd = null;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 10) return;

  //Pieces drift apart along the normal of the cut.
  const nx = -dy / length;
  const ny = dx / length;

  const result = [];
  for (const piece of pieces) {
    const left = clipHalf(piece.outline, a, b, true);
    const right = clipHalf(piece.outline, a, b, false);

    //The line missed this piece, or would only shave a sliver off it.
    if (left.length < 3 || right.length < 3 ||
        area(left) < MIN_AREA || area(right) < MIN_AREA) {
      result.push(piece);
      continue;
    }

    const push = (3 + Math.random() * 4) * DRIFT_SPEED;
    result.push({
      outline: left,
      r: jitter(piece.r), g: jitter(piece.g), b: jitter(piece.b),
      vx: nx * push, vy: ny * push,
    });
    result.push({
      outline: right,
      r: jitter(piece.r), g: jitter(piece.g), b: jitter(piece.b),
      vx: -nx * push, vy: -ny * push,
    });
  }

  pieces.length = 0;
  pieces.push(...result);
  console.log('pieces: ' + pieces.length);
});

let lastTime = 0;

function animate(time) {
  const dt = lastTime === 0 ? 0.016 : Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  //Move the pieces that are still drifting.
  for (const piece of pieces) {
    if (Math.abs(piece.vx) < DRIFT_STOP && Math.abs(piece.vy) < DRIFT_STOP) {
      piece.vx = 0;
      piece.vy = 0;
      continue;
    }
    for (const p of piece.outline) {
      p.x += piece.vx * dt;
      p.y += piece.vy * dt;
    }
    piece.vx *= DAMPING;
    piece.vy *= DAMPING;
  }

  canvas.clear();

  for (const piece of pieces) {
    const shape = new TVG.Shape();
    shape.moveTo(piece.outline[0].x, piece.outline[0].y);
    for (let i = 1; i < piece.outline.length; i++) {
      shape.lineTo(piece.outline[i].x, piece.outline[i].y);
    }
    shape.close();
    shape.fill(piece.r, piece.g, piece.b, 255);
    shape.stroke({ width: 2, color: [14, 14, 18, 255] });
    canvas.add(shape);
  }

  //Preview of the cut while dragging.
  if (dragBegin && dragEnd) {
    const guide = new TVG.Shape();
    guide.moveTo(dragBegin.x, dragBegin.y);
    guide.lineTo(dragEnd.x, dragEnd.y);
    guide.stroke({ width: 2, color: [255, 90, 90, 200] });
    canvas.add(guide);
  }

  canvas.render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
`
};
