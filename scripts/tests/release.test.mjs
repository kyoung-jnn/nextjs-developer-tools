import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

// Ported from nextjs-obsidian-blog-kit test/release.test.ts (docs/design/12-versioning.md §1.4).
const releaseScript = new URL('../release.sh', import.meta.url).pathname;
const run = (command, args, cwd, env) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', env });

function fixture(version, env) {
  const temp = mkdtempSync(join(tmpdir(), 'nextjs-devtools-release-'));
  const remote = join(temp, 'remote.git');
  const repo = join(temp, 'repository');
  run('git', ['init', '--bare', remote], temp);
  run('git', ['init', '-b', 'main', repo], temp);
  run('git', ['remote', 'add', 'origin', remote], repo);
  writeFileSync(join(repo, 'package.json'), `${JSON.stringify({ version })}\n`);
  run('git', ['add', 'package.json'], repo, env);
  run(
    'git',
    [
      '-c',
      'user.name=Release Test',
      '-c',
      'user.email=release@example.com',
      'commit',
      '-m',
      'feat: fixture',
    ],
    repo,
    env,
  );
  run('git', ['push', '-u', 'origin', 'main'], repo, env);
  return { temp, remote, repo };
}

test('creates and pushes an annotated tag from package.json version', () => {
  const { temp, remote, repo } = fixture('0.2.0');
  try {
    run('git', ['config', 'user.name', 'Release Test'], repo);
    run('git', ['config', 'user.email', 'release@example.com'], repo);
    assert.match(run('bash', [releaseScript], repo), /v0\.2\.0/);
    assert.equal(run('git', ['tag', '--points-at', 'HEAD'], repo).trim(), 'v0.2.0');
    assert.match(
      run('git', ['for-each-ref', 'refs/tags/v0.2.0', '--format=%(objecttype) %(contents)'], repo),
      /^tag Release v0\.2\.0/,
    );
    assert.match(
      run('git', ['--git-dir', remote, 'show-ref', '--tags'], temp),
      /refs\/tags\/v0\.2\.0/,
    );
  } finally {
    rmSync(temp, { force: true, recursive: true });
  }
});

test('is a no-op when the tag already exists', () => {
  const { temp, repo } = fixture('0.3.0');
  try {
    run('git', ['config', 'user.name', 'Release Test'], repo);
    run('git', ['config', 'user.email', 'release@example.com'], repo);
    run('bash', [releaseScript], repo);
    assert.match(run('bash', [releaseScript], repo), /Tag v0\.3\.0 already exists\./);
  } finally {
    rmSync(temp, { force: true, recursive: true });
  }
});

test('accepts prerelease versions and rejects invalid SemVer', () => {
  const pre = fixture('1.0.0-beta.1');
  try {
    run('git', ['config', 'user.name', 'Release Test'], pre.repo);
    run('git', ['config', 'user.email', 'release@example.com'], pre.repo);
    assert.match(run('bash', [releaseScript], pre.repo), /v1\.0\.0-beta\.1/);
  } finally {
    rmSync(pre.temp, { force: true, recursive: true });
  }
  const bad = fixture('1.0');
  try {
    assert.throws(
      () => execFileSync('bash', [releaseScript], { cwd: bad.repo, stdio: 'pipe' }),
      (error) => /valid SemVer/.test(String(error.stderr)),
    );
    assert.equal(run('git', ['tag'], bad.repo).trim(), '');
  } finally {
    rmSync(bad.temp, { force: true, recursive: true });
  }
});

test('creates the tag when the repository has no Git identity', () => {
  const {
    GIT_AUTHOR_EMAIL: _a,
    GIT_AUTHOR_NAME: _b,
    GIT_COMMITTER_EMAIL: _c,
    GIT_COMMITTER_NAME: _d,
    ...rest
  } = process.env;
  const home = mkdtempSync(join(tmpdir(), 'nextjs-devtools-home-'));
  const env = {
    ...rest,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    HOME: home,
    XDG_CONFIG_HOME: join(home, 'config'),
  };
  const { temp, repo } = fixture('0.4.0', env);
  try {
    run('bash', [releaseScript], repo, env);
    assert.equal(
      run('git', ['config', '--local', 'user.name'], repo, env).trim(),
      'github-actions[bot]',
    );
    assert.equal(run('git', ['tag', '--points-at', 'HEAD'], repo, env).trim(), 'v0.4.0');
  } finally {
    rmSync(temp, { force: true, recursive: true });
    rmSync(home, { force: true, recursive: true });
  }
});
