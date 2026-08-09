import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const bundleDirectory = path.resolve('dist', '_expo', 'static', 'js', 'web');
const filenames = await readdir(bundleDirectory);
const workerFilenames = filenames.filter((filename) =>
  /^worker-.*\.js$/.test(filename),
);
const commonFilename = filenames.find((filename) =>
  /^__common-.*\.js$/.test(filename),
);

if (workerFilenames.length === 0) {
  throw new Error(`No exported web worker was found in ${bundleDirectory}`);
}

if (commonFilename === undefined) {
  console.info(
    'Web workers are already self-contained; no shared chunk was emitted.',
  );
  process.exit(0);
}

const commonSource = await readFile(
  path.join(bundleDirectory, commonFilename),
  'utf8',
);
const marker = '/* HFM_WORKER_SHARED_MODULES */';

for (const workerFilename of workerFilenames) {
  const workerPath = path.join(bundleDirectory, workerFilename);
  const workerSource = await readFile(workerPath, 'utf8');
  if (workerSource.includes(marker)) continue;

  // Expo workers have an isolated Metro runtime. SDK 57 can extract a module
  // shared by the app and worker into __common, then start the worker without
  // loading that chunk. Insert the shared definitions before Metro runs the
  // worker entry so every required module exists in the worker's own runtime.
  const runModuleIndex = workerSource.lastIndexOf('\n__r(');
  if (runModuleIndex < 0) {
    throw new Error(
      `Could not locate the Metro worker entry in ${workerFilename}`,
    );
  }

  const patchedSource = [
    workerSource.slice(0, runModuleIndex + 1),
    marker,
    commonSource.trim(),
    workerSource.slice(runModuleIndex + 1),
  ].join('\n');
  await writeFile(workerPath, patchedSource);
  console.info(`Made ${workerFilename} self-contained with ${commonFilename}.`);
}
