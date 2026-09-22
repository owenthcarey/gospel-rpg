import { execFileSync } from 'node:child_process';
import { auditEvidence } from './evidence.ts';

// Include untracked, non-ignored files so accidental captures fail locally before
// git add. Omit tracked deletions so a pending curation can also be checked.
const paths = new Set(
  execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean),
);
for (const path of execFileSync('git', ['ls-files', '-z', '--deleted'], { encoding: 'utf8' }).split(
  '\0',
))
  paths.delete(path);
const errors = auditEvidence(process.cwd(), [...paths]);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    'Evidence checks passed: declared binaries, file references, SHA-256 hashes and gallery budgets.',
  );
