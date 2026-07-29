/**
 * Minimal worker pool: hands each queued render job to the first idle worker.
 * Deliberately not a dependency — the whole contract is "run these N jobs, tell me
 * when they are all done", and job order does not matter because the manifest sorts.
 */

import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

const WORKER = join(dirname(fileURLToPath(import.meta.url)), 'render-worker.mjs');

/** Leave a core for the main thread; more than 8 stops paying for itself. */
export const defaultConcurrency = Math.max(1, Math.min(cpus().length - 1, 8));

export async function runRenderJobs(jobs, { font, concurrency = defaultConcurrency }) {
  if (!jobs.length) return [];

  const size = Math.min(concurrency, jobs.length);
  const workers = Array.from({ length: size }, () => new Worker(WORKER, { workerData: { font } }));
  const results = [];
  let next = 0;

  try {
    await new Promise((resolve, reject) => {
      let settled = 0;

      const fail = (error) => {
        settled = jobs.length;
        reject(error);
      };

      const dispatch = (worker) => {
        if (next >= jobs.length) return;
        worker.postMessage(jobs[next++]);
      };

      for (const worker of workers) {
        worker.on('message', (result) => {
          if (!result.ok) {
            fail(new Error(`Failed to render ${result.path}: ${result.message}`));
            return;
          }
          results.push(result);
          if (++settled === jobs.length) {
            resolve();
            return;
          }
          dispatch(worker);
        });
        worker.on('error', fail);
        dispatch(worker);
      }
    });
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }

  return results;
}
