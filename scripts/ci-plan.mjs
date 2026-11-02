// Decides how much CI checks (D75). Prints `mode=<skip|core|full>` for $GITHUB_OUTPUT and says why.
//   skip: nothing in the app changed (notes only), or this exact code was already tested in its pull request
//   core: a pull request into dev: the quick check
//   full: a pull request into main (going live), a run by hand, or anything unexpected
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const { EVENT, BASE_REF, REF } = process.env;

/** Files that never reach the app: notes, the spec, design notes. */
const isNotes = (file) => file.endsWith('.md') || file.startsWith('design/');

function plan() {
  if (EVENT === 'pull_request') {
    // The checkout is GitHub's trial merge: its first parent is the target branch, so this is the pull request's change.
    const files = git('diff', '--name-only', 'HEAD^1', 'HEAD').split('\n').filter(Boolean);
    if (files.length > 0 && files.every(isNotes)) return ['skip', 'only notes changed: ' + files.join(', ')];
    if (BASE_REF === 'main') return ['full', 'going live: every browser test'];
    return ['core', 'a change into dev: the quick check'];
  }
  if (EVENT === 'push' && REF === 'refs/heads/main') {
    // A release is a merge commit whose second parent is dev; its pull request ran every test on exactly this code.
    const parents = git('rev-list', '--parents', '-n', '1', 'HEAD').split(' ').length - 1;
    if (parents === 2 && git('rev-parse', 'HEAD^{tree}') === git('rev-parse', 'HEAD^2^{tree}'))
      return ['skip', 'the release pull request already ran every test on this code'];
    return ['full', 'not a plain release merge: every browser test'];
  }
  if (EVENT === 'push' && REF === 'refs/heads/dev')
    return ['skip', 'tested in its pull request; every test runs again before it goes live'];
  return ['full', `${EVENT}: every browser test`];
}

const [mode, why] = plan();
console.error(`CI plan: ${mode} (${why})`);
console.log(`mode=${mode}`);
