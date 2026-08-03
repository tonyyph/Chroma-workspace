/**
 * Geometry + SVG primitives, ported 1:1 from the generator embedded in
 * `Chroma Wave Final Concept.dc.html` (class Component extends DCLogic).
 *
 * The identity document renders its artwork through React.createElement; here the
 * same functions emit SVG source strings so the marks can be rasterised for
 * production. Function names, argument order and the sampling constants
 * (56 sine steps, 160 squircle steps) are kept identical so any future revision
 * of the identity document can be diffed against this file line by line.
 */

const escapeAttribute = (value) => String(value).replace(/"/g, '&quot;');

export function element(tag, attributes = {}, children = []) {
  const kids = (Array.isArray(children) ? children : [children]).filter(Boolean);
  const attrs = Object.entries(attributes)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`)
    .join('');
  return kids.length ? `<${tag}${attrs}>${kids.join('')}</${tag}>` : `<${tag}${attrs}/>`;
}

/** Two-stop linear gradient in user space. */
export function lg(id, c1, c2, x1, y1, x2, y2) {
  return element('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1, y1, x2, y2 }, [
    element('stop', { offset: 0, 'stop-color': c1 }),
    element('stop', { offset: 1, 'stop-color': c2 }),
  ]);
}

/** Radial gradient from `[offset, colour, opacity?]` stop tuples. */
export function rg(id, stops, cx, cy, r) {
  return element(
    'radialGradient',
    { id, gradientUnits: 'userSpaceOnUse', cx, cy, r },
    stops.map(([offset, stopColor, stopOpacity]) =>
      element('stop', {
        offset,
        'stop-color': stopColor,
        'stop-opacity': stopOpacity == null ? 1 : stopOpacity,
      }),
    ),
  );
}

export function blur(id, sd) {
  return element('filter', { id, x: '-30%', y: '-30%', width: '160%', height: '160%' }, [
    element('feGaussianBlur', { stdDeviation: sd }),
  ]);
}

/**
 * Polyline sampling of `mid + amp * sin(2π · cyc · t + ph)` across [x0, x1].
 * This is the single primitive behind every Chroma Wave band.
 */
export function sine(mid, amp, cyc, ph, x0, x1) {
  let d = '';
  const steps = 56;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = mid + amp * Math.sin(2 * Math.PI * cyc * t + ph);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d;
}

/** Superellipse of degree `n` — the Chroma Signal glass body and the iOS mask shape. */
export function squircle(cx, cy, r, n) {
  let d = '';
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const x = cx + r * Math.sign(ca) * Math.abs(ca) ** (2 / n);
    const y = cy + r * Math.sign(sa) * Math.abs(sa) ** (2 / n);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return `${d}Z`;
}

export function svg(viewBox, defs, kids) {
  const body = [
    defs.length ? element('defs', {}, defs) : '',
    ...(Array.isArray(kids) ? kids : [kids]),
  ]
    .filter(Boolean)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
}
