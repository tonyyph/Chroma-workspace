/**
 * BUILD KIT · 04 · ANIMATION ASSET INVENTORY — the Lottie deliverables.
 *
 * The kit constrains these hard, and the constraint is what makes generating
 * them tractable: "Lottie files carry no expressions, no merge paths, no image
 * layers — shape layers only, so they render identically on both platforms."
 * Everything below is shape layers with linear/bezier keyframes.
 *
 * Timings, loop flags and the 60fps rate come from the deliverables table.
 */

const FPS = 60;

/** Lottie stores colours as 0-1 RGBA arrays, not hex. */
function rgba(hex, alpha = 1) {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, alpha];
}

const frames = (ms) => Math.round((ms / 1000) * FPS);

/** A static property. */
const value = (v) => ({ a: 0, k: v });

/** An animated property from `[{ t, v, easing? }]` keyframes. */
function animate(keys) {
  return {
    a: 1,
    k: keys.map((key, index) => {
      const next = keys[index + 1];
      const frame = { t: key.t, s: Array.isArray(key.v) ? key.v : [key.v] };
      if (!next) return frame;
      const [x1, y1, x2, y2] = key.easing ?? [0.32, 0.72, 0, 1];
      return { ...frame, i: { x: [x2], y: [y2] }, o: { x: [x1], y: [y1] } };
    }),
  };
}

/** A rounded-rectangle shape layer — the only primitive these files need. */
function bandLayer({ name, index, colour, y, width, height, transform }) {
  return {
    ddd: 0,
    ind: index,
    ty: 4,
    nm: name,
    sr: 1,
    ks: {
      o: transform.opacity ?? value(100),
      r: value(0),
      p: transform.position ?? value([195, y, 0]),
      a: value([0, 0, 0]),
      s: transform.scale ?? value([100, 100, 100]),
    },
    ao: 0,
    shapes: [
      {
        ty: 'gr',
        it: [
          {
            ty: 'rc',
            d: 1,
            s: value([width, height]),
            p: value([0, 0]),
            r: value(height / 2),
          },
          { ty: 'fl', c: value(rgba(colour)), o: value(100), r: 1 },
          {
            ty: 'tr',
            p: value([0, 0]),
            a: value([0, 0]),
            s: value([100, 100]),
            r: value(0),
            o: value(100),
          },
        ],
        nm: `${name} group`,
      },
    ],
    ip: 0,
    op: transform.outPoint ?? 9999,
    st: 0,
  };
}

function document({ name, durationMs, layers, width = 390, height = 844, loop = false }) {
  return {
    v: '5.7.4',
    fr: FPS,
    ip: 0,
    op: frames(durationMs),
    w: width,
    h: height,
    nm: name,
    ddd: 0,
    assets: [],
    layers,
    markers: [],
    // Consumed by our own loader; Lottie players take loop from the call site.
    meta: { loop, generator: 'chromawave/brand-assets' },
  };
}

const BANDS = ['#7C5CFF', '#22D3EE', '#FF7A5C'];

/** launch.json · 1480ms · no loop. The cold-launch storyboard, frame for frame. */
function launch() {
  const layers = [];

  // Seed dot: scale 0→1 over 180ms, standard curve.
  layers.push(
    bandLayer({
      name: 'seed dot',
      index: 1,
      colour: '#FFFFFF',
      y: 402,
      width: 10,
      height: 10,
      transform: {
        scale: animate([
          { t: 0, v: [0, 0, 100] },
          { t: frames(180), v: [100, 100, 100] },
        ]),
        opacity: animate([
          { t: frames(700), v: 100 },
          { t: frames(760), v: 0 },
        ]),
      },
    }),
  );

  // Bands sweep x −40%→0, 240ms each, 80ms stagger, sweep curve.
  BANDS.forEach((colour, i) => {
    const start = frames(180 + i * 80);
    layers.push(
      bandLayer({
        name: `band ${i + 1}`,
        index: 2 + i,
        colour,
        y: 378 + i * 24,
        width: 198,
        height: 22,
        transform: {
          position: animate([
            { t: start, v: [195 - 156, 378 + i * 24, 0], easing: [0.16, 1, 0.3, 1] },
            { t: start + frames(240), v: [195, 378 + i * 24, 0] },
          ]),
          opacity: animate([
            { t: start, v: 0 },
            { t: start + frames(120), v: 85 },
          ]),
        },
      }),
    );
  });

  // Glass body: the mask reveal is expressed as a scale on the squircle, since
  // "no merge paths" rules out a real trim-path mask.
  layers.push(
    bandLayer({
      name: 'glass',
      index: 5,
      colour: '#EDE8F4',
      y: 402,
      width: 156,
      height: 156,
      transform: {
        scale: animate([
          { t: frames(760), v: [0, 0, 100] },
          { t: frames(1080), v: [100, 100, 100] },
        ]),
        opacity: animate([
          { t: frames(760), v: 0 },
          { t: frames(900), v: 22 },
        ]),
      },
    }),
  );

  // Wordmark plate: fade + rise 8px over 220ms.
  layers.push(
    bandLayer({
      name: 'wordmark',
      index: 6,
      colour: '#EDEAE3',
      y: 528,
      width: 168,
      height: 12,
      transform: {
        position: animate([
          { t: frames(1080), v: [195, 536, 0] },
          { t: frames(1300), v: [195, 528, 0] },
        ]),
        opacity: animate([
          { t: frames(1080), v: 0 },
          { t: frames(1300), v: 80 },
        ]),
      },
    }),
  );

  return document({ name: 'launch', durationMs: 1480, layers });
}

/** loading-bands.json · 1100ms · loops. Replaces every spinner. */
function loadingBands() {
  const layers = BANDS.map((colour, i) =>
    bandLayer({
      name: `band ${i + 1}`,
      index: i + 1,
      colour,
      y: 60 + i * 34,
      width: 240,
      height: 30,
      transform: {
        position: animate([
          { t: 0, v: [80, 60 + i * 34, 0], easing: [0.16, 1, 0.3, 1] },
          { t: frames(550), v: [310, 60 + i * 34, 0], easing: [0.16, 1, 0.3, 1] },
          { t: frames(1100), v: [80, 60 + i * 34, 0] },
        ]),
        opacity: value(85),
      },
    }),
  );
  return document({ name: 'loading-bands', durationMs: 1100, layers, height: 200, loop: true });
}

/** save-success.json · 640ms · no loop. Bands converge, then a check forms. */
function saveSuccess() {
  const layers = BANDS.map((colour, i) =>
    bandLayer({
      name: `band ${i + 1}`,
      index: i + 1,
      colour,
      y: 86 + i * 14,
      width: 108,
      height: 13,
      transform: {
        position: animate([
          { t: 0, v: [100, 70 + i * 30, 0] },
          { t: frames(160), v: [100, 100, 0] },
        ]),
        opacity: animate([
          { t: frames(160), v: 100 },
          { t: frames(380), v: 0 },
        ]),
      },
    }),
  );

  // The check is two rounded bars rotated into a tick — no merge paths needed.
  layers.push(
    bandLayer({
      name: 'check short',
      index: 4,
      colour: '#EDEAE3',
      y: 108,
      width: 34,
      height: 8,
      transform: {
        position: value([88, 108, 0]),
        opacity: animate([
          { t: frames(380), v: 0 },
          { t: frames(500), v: 100 },
        ]),
        scale: animate([
          { t: frames(380), v: [0, 100, 100] },
          { t: frames(500), v: [100, 100, 100] },
        ]),
      },
    }),
    bandLayer({
      name: 'check long',
      index: 5,
      colour: '#EDEAE3',
      y: 96,
      width: 58,
      height: 8,
      transform: {
        position: value([116, 96, 0]),
        opacity: animate([
          { t: frames(440), v: 0 },
          { t: frames(600), v: 100 },
        ]),
        scale: animate([
          { t: frames(440), v: [0, 100, 100] },
          { t: frames(600), v: [100, 100, 100] },
        ]),
      },
    }),
  );

  return document({ name: 'save-success', durationMs: 640, layers, width: 200, height: 200 });
}

/** sync-orbit.json · 1600ms · loops. The only rotating element in the app. */
function syncOrbit() {
  const layers = BANDS.map((colour, i) => ({
    ddd: 0,
    ind: i + 1,
    ty: 4,
    nm: `arc ${i + 1}`,
    sr: 1,
    ks: {
      o: value(90),
      r: animate([
        { t: 0, v: i * 40, easing: [0, 0, 1, 1] },
        { t: frames(1600), v: i * 40 + 360 },
      ]),
      p: value([100, 100, 0]),
      a: value([0, 0, 0]),
      s: value([100, 100, 100]),
    },
    ao: 0,
    shapes: [
      {
        ty: 'gr',
        it: [
          { ty: 'el', d: 1, s: value([(40 + i * 13) * 2, (40 + i * 13) * 2]), p: value([0, 0]) },
          {
            ty: 'st',
            c: value(rgba(colour)),
            o: value(100),
            w: value(8),
            lc: 2,
            lj: 1,
            // Dash + gap reproduces the arc without a trim path.
            d: [
              { n: 'd', nm: 'dash', v: value(60 + i * 30) },
              { n: 'g', nm: 'gap', v: value(400) },
            ],
          },
          {
            ty: 'tr',
            p: value([0, 0]),
            a: value([0, 0]),
            s: value([100, 100]),
            r: value(0),
            o: value(100),
          },
        ],
        nm: `arc ${i + 1} group`,
      },
    ],
    ip: 0,
    op: frames(1600),
    st: 0,
  }));
  return document({
    name: 'sync-orbit',
    durationMs: 1600,
    layers,
    width: 200,
    height: 200,
    loop: true,
  });
}

/** empty-*.json ×4 · 900ms · loops. One band breathing inside the mark outline. */
function empty(kind) {
  const accent = { library: '#7C5CFF', results: '#22D3EE', offline: '#FF7A5C', loading: '#FFC24A' };
  const layers = [
    bandLayer({
      name: 'body',
      index: 1,
      colour: '#2A2440',
      y: 130,
      width: 184,
      height: 184,
      transform: { position: value([200, 130, 0]), opacity: value(30) },
    }),
    bandLayer({
      name: 'band',
      index: 2,
      colour: accent[kind] ?? '#7C5CFF',
      y: 130,
      width: 140,
      height: 12,
      transform: {
        position: value([200, 130, 0]),
        opacity: animate([
          { t: 0, v: 40 },
          { t: frames(450), v: 100 },
          { t: frames(900), v: 40 },
        ]),
        scale: animate([
          { t: 0, v: [88, 100, 100] },
          { t: frames(450), v: [100, 100, 100] },
          { t: frames(900), v: [88, 100, 100] },
        ]),
      },
    }),
  ];
  return document({
    name: `empty-${kind}`,
    durationMs: 900,
    layers,
    width: 400,
    height: 260,
    loop: true,
  });
}

/** The full inventory from the deliverables table, minus the native ones. */
export const lottieFiles = {
  launch,
  'loading-bands': loadingBands,
  'save-success': saveSuccess,
  'sync-orbit': syncOrbit,
  'empty-library': () => empty('library'),
  'empty-results': () => empty('results'),
  'empty-offline': () => empty('offline'),
  'empty-loading': () => empty('loading'),
};
