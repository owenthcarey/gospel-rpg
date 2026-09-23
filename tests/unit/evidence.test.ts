import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { auditEvidence, MANIFEST_PATH } from '../../tools/ci/evidence';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'gospel-evidence-'));
  roots.push(root);
  const paths = new Set<string>();
  function put(name: string, value: string | Buffer) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), value);
    paths.add(name);
  }
  const name = 'docs/verification/scene.png';
  const bytes = Buffer.from([137, 80, 78, 71, 0, 1]);
  const manifest = {
    version: 1,
    maxTotalBytes: 100,
    collections: { scene: { title: 'Scene', maxFiles: 1, maxBytes: 100, exceptionReason: '' } },
    files: [
      {
        path: name,
        collection: 'scene',
        purpose: 'Phone layout',
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      },
    ],
  };
  put(name, bytes);
  put('docs/verification/README.md', '[Scene](scene.png)\n');
  function save() {
    put(MANIFEST_PATH, JSON.stringify(manifest));
  }
  function check() {
    save();
    return auditEvidence(root, [...paths]);
  }
  return { root, paths, put, name, bytes, manifest, save, check };
}

describe('permanent review evidence', () => {
  it('accepts a declared gallery and exempts shipped sources and test references', () => {
    const f = fixture();
    for (const path of [
      'public/assets/models/prop.glb',
      'assets/source/kit.blend',
      'tests/e2e/screenshots/spec/reference.png',
    ])
      f.put(path, f.bytes);
    expect(f.check()).toEqual([]);
  });

  it('rejects binary captures outside the manifest, including unknown extensions', () => {
    const f = fixture();
    f.put('docs/verification/extra.png', f.bytes);
    f.put('accidental-export.bin', f.bytes);
    expect(f.check().filter((error) => error.startsWith('Unlisted binary:'))).toHaveLength(2);
  });

  it('detects both changed content and falsified byte counts', () => {
    const f = fixture();
    f.put(f.name, Buffer.from([0, 2, 3]));
    expect(f.check().join('\n')).toContain('SHA-256 mismatch');
    expect(f.check().join('\n')).toContain('Byte count mismatch');
  });

  it('does not accept an ignored file just because it exists on disk', () => {
    const f = fixture();
    f.paths.delete(f.name);
    const errors = f.check().join('\n');
    expect(errors).toContain('Missing or ignored evidence');
    expect(errors).toContain('Missing file reference');
  });

  it('rejects duplicate entries and count overflow', () => {
    const f = fixture();
    f.manifest.files.push({ ...f.manifest.files[0]! });
    const errors = f.check().join('\n');
    expect(errors).toContain('Duplicate manifest entry');
    expect(errors).toContain('1-file budget');
  });

  it('enforces actual collection and total bytes rather than trusting recorded sizes', () => {
    const f = fixture();
    f.manifest.files[0]!.bytes = 1;
    f.manifest.collections.scene.maxBytes = 2;
    f.manifest.maxTotalBytes = 3;
    const errors = f.check().join('\n');
    expect(errors).toContain('2-byte budget');
    expect(errors).toContain('3-byte total budget');
  });

  it('requires an explanation for a larger collection', () => {
    const f = fixture();
    f.manifest.collections.scene.maxFiles = 12;
    expect(f.check().join('\n')).toContain('without an exceptionReason');
    f.manifest.collections.scene.exceptionReason =
      'Four before/after pairs and four distinct reviews.';
    expect(f.check()).toEqual([]);
  });

  it.each(['../outside.png', 'docs/verification/../../outside.png', '/tmp/outside.png'])(
    'rejects an unsafe manifest path: %s',
    (path) => {
      const f = fixture();
      f.manifest.files[0]!.path = path;
      expect(f.check().join('\n')).toContain('normalized review-media path');
    },
  );

  it('validates inline, reference-style and HTML file links, ignoring examples and remote URLs', () => {
    const f = fixture();
    f.put(
      'docs/verification/README.md',
      [
        '[Scene](scene.png#detail)',
        '[Directory](./)',
        '[Root](../../)',
        '[Download][picture]',
        '[picture]: scene.png',
        '<img src="scene.png">',
        '[Remote](https://example.com/missing.png)',
        '`[example](missing.png)`',
        '```md',
        '[example](missing.png)',
        '```',
        '[Missing](gone.png)',
        '[bad][missing]',
        '[missing]: other.png',
        '<img src="absent.png">',
      ].join('\n'),
    );
    const errors = f.check().filter((error) => error.startsWith('Missing file reference'));
    expect(errors).toHaveLength(3);
    expect(errors.join('\n')).not.toContain('missing.png');
  });

  it('checks media inventories in verification JSON, including root-relative and spaced filenames', () => {
    const f = fixture();
    f.put(
      'docs/verification/report.json',
      JSON.stringify({
        images: { 'scene.png': 'digest', 'gone.png': 'digest' },
        screenshot: f.name,
        another: 'missing image.png',
      }),
    );
    const errors = f.check().filter((error) => error.startsWith('Missing file reference'));
    expect(errors).toHaveLength(2);
    expect(errors.join('\n')).toContain('missing image.png');
  });

  it('reports invalid manifests and missing disk files as failures', () => {
    const f = fixture();
    f.manifest.maxTotalBytes = 0;
    expect(f.check().join('\n')).toContain('positive total budget');
    f.manifest.maxTotalBytes = 100;
    rmSync(join(f.root, f.name));
    expect(f.check().join('\n')).toContain('Cannot read evidence');
  });

  it('the CLI detects non-ignored new binaries and excludes generated files and pending deletions', () => {
    const f = fixture();
    f.save();
    f.put('.gitignore', '/artifacts/\n');
    f.put('obsolete.md', 'Pending retirement.');
    execFileSync('git', ['init', '--quiet'], { cwd: f.root });
    execFileSync('git', ['add', '.'], { cwd: f.root });
    rmSync(join(f.root, 'obsolete.md'));
    f.put('artifacts/output.png', f.bytes);
    const run = () =>
      spawnSync(
        process.execPath,
        ['--experimental-strip-types', resolve('tools/ci/check-evidence.ts')],
        { cwd: f.root, encoding: 'utf8' },
      );
    expect(run().status).toBe(0);
    f.put('untracked.png', f.bytes);
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unlisted binary: untracked.png');
    expect(result.stderr).not.toContain('artifacts/output.png');
  });
});
