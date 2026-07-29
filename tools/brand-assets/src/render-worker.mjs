/**
 * Rasterisation worker.
 *
 * `Resvg.render()` is synchronous and CPU-bound, so rendering on the main thread
 * pins the whole build to one core no matter how much of it is wrapped in promises.
 * Each worker owns its own resvg instance and writes its own files.
 */

import { Resvg } from '@resvg/resvg-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';
import sharp from 'sharp';

const { font } = workerData;

// One thread per worker: the pool already saturates the cores, and letting libvips
// spawn its own pool on top of that just adds contention.
sharp.concurrency(1);

function rasterise(svgSource, width) {
  return new Resvg(svgSource, { fitTo: { mode: 'width', value: width }, font }).render().asPng();
}

async function encode({ svg, width, format, background }) {
  const raw = rasterise(svg, width);
  if (format === 'webp') return sharp(raw).webp({ quality: 80 }).toBuffer();
  if (format === 'flat') {
    return sharp(raw)
      .flatten({ background })
      .removeAlpha()
      .png({ compressionLevel: 9 })
      .withMetadata({ density: 72 })
      .toBuffer();
  }
  return sharp(raw).png({ compressionLevel: 9 }).toBuffer();
}

parentPort.on('message', async (job) => {
  try {
    const buffer = await encode(job);
    await mkdir(dirname(job.path), { recursive: true });
    await writeFile(job.path, buffer);
    parentPort.postMessage({ ok: true, path: job.path, bytes: buffer.length });
  } catch (error) {
    parentPort.postMessage({ ok: false, path: job.path, message: error.message });
  }
});
