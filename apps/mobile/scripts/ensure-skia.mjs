import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const skiaRoot = dirname(require.resolve('@shopify/react-native-skia/package.json'));
const iosFrameworksDirectory = join(skiaRoot, 'libs', 'apple', 'ios');

const hasIosFrameworks = () =>
  existsSync(iosFrameworksDirectory) &&
  readdirSync(iosFrameworksDirectory).some((entry) => entry.endsWith('.xcframework'));

if (!hasIosFrameworks()) {
  console.log('Skia iOS binaries are missing; running the package postinstall script...');

  const result = spawnSync(process.execPath, [join(skiaRoot, 'scripts', 'install-skia.mjs')], {
    cwd: skiaRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0 || !hasIosFrameworks()) {
    console.error('Skia postinstall did not produce the required iOS XCFrameworks.');
    process.exit(result.status || 1);
  }
}

console.log('Skia iOS binaries are ready.');
