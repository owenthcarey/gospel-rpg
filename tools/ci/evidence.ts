import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';

export const MANIFEST_PATH = 'docs/verification/manifest.json';
const MEDIA =
  /\.(?:png|jpe?g|webp|gif|avif|bmp|tiff?|ico|pdf|zip|gz|7z|tar|mp4|webm|mov|wav|mp3|ogg|flac|glb|blend\d*|woff2?|ttf|otf)$/iu;
const ASSET =
  /^(?:public\/assets\/models\/[^/]+\.glb|assets\/source\/[^/]+\.blend|tests\/e2e\/screenshots\/.+\.png)$/u;
const REVIEW_MEDIA =
  /\.(?:png|jpe?g|webp|gif|avif|bmp|tiff?|ico|pdf|zip|mp4|webm|mov|wav|mp3|ogg|flac)$/iu;

interface Collection {
  title: string;
  maxFiles: number;
  maxBytes: number;
  exceptionReason?: string;
}
interface EvidenceFile {
  path: string;
  collection: string;
  purpose: string;
  bytes: number;
  sha256: string;
}
interface Manifest {
  version: 1;
  maxTotalBytes: number;
  collections: Record<string, Collection>;
  files: EvidenceFile[];
}

const positiveInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0;
const nonempty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function manifestFrom(value: unknown): Manifest {
  if (
    !object(value) ||
    value.version !== 1 ||
    !positiveInteger(value.maxTotalBytes) ||
    !object(value.collections) ||
    !Object.keys(value.collections).length ||
    !Array.isArray(value.files)
  )
    throw new Error('Expected version 1, a positive total budget, collections and files.');
  for (const [id, collection] of Object.entries(value.collections)) {
    if (
      !nonempty(id) ||
      !object(collection) ||
      !nonempty(collection.title) ||
      !positiveInteger(collection.maxFiles) ||
      !positiveInteger(collection.maxBytes)
    )
      throw new Error(`Invalid collection: ${id}`);
    if (
      (collection.maxFiles > 6 || collection.maxBytes > 6 * 1024 * 1024) &&
      !nonempty(collection.exceptionReason)
    ) {
      throw new Error(
        `Collection ${id} exceeds the default six-file / 6 MiB limits without an exceptionReason.`,
      );
    }
  }
  for (const file of value.files) {
    if (
      !object(file) ||
      !nonempty(file.path) ||
      !file.path.startsWith('docs/verification/') ||
      posix.normalize(file.path) !== file.path ||
      file.path.includes('\\') ||
      !MEDIA.test(file.path) ||
      !nonempty(file.collection) ||
      !Object.hasOwn(value.collections, file.collection) ||
      !nonempty(file.purpose) ||
      !positiveInteger(file.bytes) ||
      typeof file.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/u.test(file.sha256)
    )
      throw new Error(
        'Every evidence file needs a normalized review-media path, collection, purpose, positive byte count and SHA-256.',
      );
  }
  return value as unknown as Manifest;
}

// Check file targets, including reference-style Markdown and HTML images. URL
// fragments describe headings, not files, and are deliberately outside this check.
function markdownTargets(contents: string): string[] {
  const prose = contents
    .replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, '')
    .replace(/`[^`\n]+`/gu, '');
  return [
    ...Array.from(
      prose.matchAll(/!?\[[^\]\n]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^\n]*?["'])?\s*\)/gu),
      (m) => m[1] ?? m[2]!,
    ),
    ...Array.from(
      prose.matchAll(/^\s{0,3}\[[^\]\n]+\]:\s*(?:<([^>]+)>|(\S+))/gmu),
      (m) => m[1] ?? m[2]!,
    ),
    ...Array.from(prose.matchAll(/(?:src|href)=["']([^"']+)["']/gu), (m) => m[1]!),
  ];
}

/** Paths must be the repository's tracked and non-ignored new files, not a disk glob. */
export function auditEvidence(root: string, paths: readonly string[]): string[] {
  const available = new Set(paths);
  const errors: string[] = [];
  const buffers = new Map<string, Buffer>();
  const read = (name: string) => {
    let buffer = buffers.get(name);
    if (!buffer) {
      if (!lstatSync(resolve(root, name)).isFile())
        throw new Error(`${name} must be a regular file`);
      buffer = readFileSync(resolve(root, name));
      buffers.set(name, buffer);
    }
    return buffer;
  };
  let manifest: Manifest;
  try {
    if (!available.has(MANIFEST_PATH)) throw new Error('Manifest is not included in the checkout.');
    manifest = manifestFrom(JSON.parse(read(MANIFEST_PATH).toString('utf8')));
  } catch (error) {
    return [`${MANIFEST_PATH}: ${String(error)}`];
  }
  const listed = new Set<string>();
  const totals = new Map<string, { count: number; bytes: number }>();
  let totalBytes = 0;
  for (const file of manifest.files) {
    if (listed.has(file.path)) errors.push(`Duplicate manifest entry: ${file.path}`);
    listed.add(file.path);
    const total = totals.get(file.collection) ?? { count: 0, bytes: 0 };
    total.count++;
    totals.set(file.collection, total);
    if (!available.has(file.path)) {
      errors.push(`Missing or ignored evidence: ${file.path}`);
      continue;
    }
    try {
      const bytes = read(file.path);
      total.bytes += bytes.length;
      totalBytes += bytes.length;
      if (bytes.length !== file.bytes)
        errors.push(
          `Byte count mismatch: ${file.path} (recorded ${file.bytes}, actual ${bytes.length})`,
        );
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      if (sha256 !== file.sha256) errors.push(`SHA-256 mismatch: ${file.path} (actual ${sha256})`);
    } catch (error) {
      errors.push(`Cannot read evidence ${file.path}: ${String(error)}`);
    }
  }
  for (const [id, collection] of Object.entries(manifest.collections)) {
    const total = totals.get(id) ?? { count: 0, bytes: 0 };
    if (total.count > collection.maxFiles)
      errors.push(`${id} exceeds its ${collection.maxFiles}-file budget (${total.count}).`);
    if (total.bytes > collection.maxBytes)
      errors.push(`${id} exceeds its ${collection.maxBytes}-byte budget (${total.bytes}).`);
  }
  if (totalBytes > manifest.maxTotalBytes)
    errors.push(
      `Review evidence exceeds its ${manifest.maxTotalBytes}-byte total budget (${totalBytes}).`,
    );

  const reference = (from: string, target: string, rootRelative = false) => {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/iu.test(target)) return;
    let path: string;
    try {
      path = decodeURIComponent(target.split(/[?#]/u)[0]!);
    } catch {
      errors.push(`Invalid file reference in ${from}: ${target}`);
      return;
    }
    if (!path) return;
    path = posix.normalize(
      rootRelative || path.startsWith('/')
        ? path.replace(/^\//u, '')
        : posix.join(posix.dirname(from), path),
    );
    path = path.replace(/\/$/u, '');
    if (path === '.') return;
    if (!available.has(path) && !paths.some((name) => name.startsWith(`${path}/`))) {
      errors.push(`Missing file reference in ${from}: ${target}`);
    }
  };
  const jsonReferences = (from: string, value: unknown): void => {
    const check = (text: string) => {
      if (REVIEW_MEDIA.test(text))
        reference(from, text, /^(?:docs|assets|public|tests|tools)\//u.test(text));
    };
    if (typeof value === 'string') check(value);
    else if (Array.isArray(value)) value.forEach((item) => jsonReferences(from, item));
    else if (object(value))
      for (const [key, item] of Object.entries(value)) {
        check(key);
        jsonReferences(from, item);
      }
  };
  for (const name of available) {
    try {
      const bytes = read(name);
      if ((MEDIA.test(name) || bytes.includes(0)) && !ASSET.test(name) && !listed.has(name)) {
        errors.push(
          `Unlisted binary: ${name}. Keep generated output in artifacts/reviews/ or declare reviewed evidence in ${MANIFEST_PATH}.`,
        );
      }
      if (name.endsWith('.md'))
        for (const target of markdownTargets(bytes.toString('utf8'))) reference(name, target);
      if (name.startsWith('docs/verification/') && name.endsWith('.json'))
        jsonReferences(name, JSON.parse(bytes.toString('utf8')));
    } catch (error) {
      errors.push(`Cannot inspect ${name}: ${String(error)}`);
    }
  }
  return errors;
}
