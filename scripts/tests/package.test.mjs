import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// docs/design/12-versioning.md §2.3: the release zip is installable and ships no source maps.
const root = new URL('../..', import.meta.url).pathname;
const hasZip = spawnSync('zip', ['-v'], { stdio: 'ignore' }).status === 0;

test('packages the extension with the root version and no source maps', { skip: !hasZip }, () => {
  const { version } = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  );
  const output = execFileSync('bash', ['scripts/package-extension.sh'], {
    cwd: root,
    encoding: 'utf8',
  });
  const zip = `artifacts/nextjs-developer-tools-v${version}.zip`;
  assert.match(output, new RegExp(zip.replaceAll('.', '\\.')));
  const listing = execFileSync('unzip', ['-Z1', zip], { cwd: root, encoding: 'utf8' }).split('\n');
  assert.ok(listing.includes('manifest.json'), 'manifest.json must be at the zip root');
  assert.ok(listing.includes('background.js'));
  assert.equal(listing.filter((name) => name.endsWith('.map')).length, 0);
  const manifest = JSON.parse(
    execFileSync('unzip', ['-p', zip, 'manifest.json'], { cwd: root, encoding: 'utf8' }),
  );
  assert.equal(manifest.version, version.split(/[-+]/)[0]);
});
