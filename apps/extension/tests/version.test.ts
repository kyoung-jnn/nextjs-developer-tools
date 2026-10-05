import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error - plain ESM build helper without type declarations
import { chromeVersion, rootVersion, withVersion } from '../scripts/version.mjs';

describe('chromeVersion (docs/design/12-versioning.md §2.1)', () => {
  it('passes plain SemVer through', () => {
    expect(chromeVersion('1.2.3')).toEqual({ version: '1.2.3' });
    expect(chromeVersion('0.1.0')).toEqual({ version: '0.1.0' });
  });
  it('moves prerelease and build metadata to version_name', () => {
    expect(chromeVersion('1.2.3-beta.1')).toEqual({
      version: '1.2.3',
      version_name: '1.2.3-beta.1',
    });
    expect(chromeVersion('1.2.3+build.5')).toEqual({
      version: '1.2.3',
      version_name: '1.2.3+build.5',
    });
  });
  it('rejects invalid SemVer and parts Chrome cannot store', () => {
    expect(() => chromeVersion('1.2')).toThrow(/valid SemVer/);
    expect(() => chromeVersion('01.2.3')).toThrow(/valid SemVer/);
    expect(() => chromeVersion('1.70000.0')).toThrow(/65535/);
  });
});

describe('manifest stamping', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'),
  );
  it('keeps a placeholder in the source manifest', () => {
    expect(manifest.version).toBe('0.0.0');
  });
  it('stamps the root package.json version and drops a stale version_name', () => {
    const root = JSON.parse(
      readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
    ).version;
    expect(rootVersion()).toBe(root);
    expect(withVersion({ ...manifest, version_name: 'old' }, root)).toMatchObject({
      version: root.split(/[-+]/)[0],
    });
    expect(withVersion({ ...manifest, version_name: 'old' }, '2.0.0')).not.toHaveProperty(
      'version_name',
    );
  });
});
