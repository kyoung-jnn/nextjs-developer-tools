import { readFileSync } from 'node:fs';

// Same SemVer pattern as scripts/release.sh (docs/design/12-versioning.md).
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

/**
 * Map a SemVer product version to Chrome manifest fields. Chrome's `version` allows only
 * dot-separated integers (each 0–65535), so prerelease/build parts move to `version_name`.
 * @param {string} semver
 * @returns {{ version: string, version_name?: string }}
 */
export function chromeVersion(semver) {
  const match = SEMVER.exec(semver);
  if (!match) throw new Error(`Root package.json version must be valid SemVer: "${semver}"`);
  const parts = match.slice(1, 4).map(Number);
  if (parts.some((part) => part > 65535))
    throw new Error(`Chrome version parts must be at most 65535: "${semver}"`);
  const version = parts.join('.');
  return version === semver ? { version } : { version, version_name: semver };
}

/** The product version: the root package.json `version`. */
export function rootVersion(rootPackageJson = new URL('../../../package.json', import.meta.url)) {
  return JSON.parse(readFileSync(rootPackageJson, 'utf8')).version;
}

/** Apply the product version to a parsed manifest object (returns a new object). */
export function withVersion(manifest, semver) {
  const { version_name: _previous, ...rest } = manifest;
  return { ...rest, ...chromeVersion(semver) };
}
