import { useState } from 'preact/hooks';
import { CopyIcon, SaveIcon } from '../icons';

const FILE_NAME = 'green-tracker-recovery-codes.txt';

function asText(username: string, codes: string[]): string {
  return [
    `Green Tracker recovery codes for @${username}`,
    'Each code works once. Keep them somewhere safe.',
    '',
    ...codes.map((c, i) => `${String(i + 1).padStart(2, ' ')}. ${c}`),
    '',
  ].join('\n');
}

/** The codes block with Copy and Save, as on the approved mockup. */
export function RecoveryCodesBlock(p: { username: string; codes: string[] }) {
  const [note, setNote] = useState('');
  const text = asText(p.username, p.codes);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setNote('Copied.');
    } catch {
      setNote('Couldn’t copy. Select the codes and copy them instead.');
    }
  }

  async function save() {
    const file = new File([text], FILE_NAME, { type: 'text/plain' });
    // On iPhone the share sheet offers "Save to Files", which works in the installed app too.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        setNote('');
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = FILE_NAME;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNote('Saved to your downloads.');
  }

  return (
    <div class="stack">
      <ol class="codes" aria-label="Recovery codes">
        {p.codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <div class="btn-row">
        <button class="btn secondary" onClick={copy}>
          <CopyIcon />
          Copy
        </button>
        <button class="btn secondary" onClick={save}>
          <SaveIcon />
          Save
        </button>
      </div>
      <p class="hint" role="status">
        {note}
      </p>
    </div>
  );
}
