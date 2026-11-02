// Decides how much CI checks (D75). Prints `mode=<skip|core|full>` for $GITHUB_OUTPUT and says why.
//   skip: nothing in the app changed (notes only), or this exact code was already tested in its pull request
//   core: a pull request into dev: the quick check
//   full: a pull request into main (going live), a run by hand, or anything unexpected
// test/domain/ci.test.ts checks the decisions.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Files that never reach the app: notes, the spec, design notes. */
export const isNotes = (file) => file.endsWith('.md') || file.startsWith('design/');

/**
 * @param {{ event?: string, baseRef?: string, ref?: string }} run
 * @param {{ changedFiles: () => string[], isReleaseMerge: () => boolean }} facts read from git only when needed
 * @returns {[mode: 'skip' | 'core' | 'full', why: string]}
 */
export function plan({ event, baseRef, ref }, facts) {
  if (event === 'pull_request') {
    const files = facts.changedFiles();
    if (files.length > 0 && files.every(isNotes)) return ['skip', 'only notes changed: ' + files.join(', ')];
    if (baseRef === 'main') return ['full', 'going live: every browser test'];
    return ['core', 'a change into dev: the quick check'];
  }
  if (event === 'push' && ref === 'refs/heads/main') {
    if (facts.isReleaseMerge()) return ['skip', 'the release pull request already ran every test on this code'];
    return ['full', 'not a plain release merge: every browser test'];
  }
  if (event === 'push' && ref === 'refs/heads/dev') return ['skip', 'tested in its pull request; every test runs again before it goes live'];
  return ['full', `${event}: every browser test`];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const [mode, why] = plan(
    { event: process.env.EVENT, baseRef: process.env.BASE_REF, ref: process.env.REF },
    {
      // A pull request's checkout is GitHub's trial merge: its first parent is the target branch.
      changedFiles: () => git('diff', '--name-only', 'HEAD^1', 'HEAD').split('\n').filter(Boolean),
      // A release is a merge commit whose second parent is dev; its pull request tested exactly this code.
      isReleaseMerge: () =>
        git('rev-list', '--parents', '-n', '1', 'HEAD').split(' ').length === 3 && git('rev-parse', 'HEAD^{tree}') === git('rev-parse', 'HEAD^2^{tree}'),
    },
  );
  console.error(`CI plan: ${mode} (${why})`);
  console.log(`mode=${mode}`);
}
