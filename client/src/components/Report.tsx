import { useState } from 'preact/hooks';
import { REPORT_REASONS, type ReportReason } from '../../../shared/domain/trust';
import { errorText } from '../api';
import { CheckIcon } from '../icons';

// D84: the report sheet: why, in one tap. For a person, "Also block" starts ticked.

const NOUN = { post: 'post', comment: 'comment', person: 'person' } as const;

export function ReportSheet(p: { what: 'post' | 'comment' | 'person'; username: string; onReport: (reason: ReportReason, block: boolean) => Promise<void>; onCancel: () => void }) {
  const [block, setBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const title = `Why are you reporting this ${NOUN[p.what]}?`;
  const pick = async (reason: ReportReason) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await p.onReport(reason, p.what === 'person' && block);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <>
      <div class="scrim" onClick={p.onCancel} />
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div class="grp">
          <div class="ttl">
            <strong>{title}</strong>
            {p.what === 'person' ? 'Anton gets a look. They aren’t told who reported them.' : 'It’s hidden for you straight away. Anton gets a look. They aren’t told who reported it.'}
          </div>
          {REPORT_REASONS.map((r) => (
            <button type="button" key={r.key} class="opt" disabled={busy} onClick={() => pick(r.key)}>
              {r.label}
            </button>
          ))}
          {p.what === 'person' && (
            <button type="button" class="opt tickopt" role="checkbox" aria-checked={block} onClick={() => setBlock(!block)}>
              <span class="box" aria-hidden="true">
                {block && <CheckIcon />}
              </span>
              Also block @{p.username}
            </button>
          )}
          {error && (
            <p class="error" role="alert" style={{ padding: '8px 16px' }}>
              {error}
            </p>
          )}
        </div>
        <div class="grp">
          <button type="button" class="opt bold" onClick={p.onCancel} autoFocus>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

/** Shown in place of what you reported. */
export function Reported(p: { what: 'post' | 'comment'; onShow: () => void; small?: boolean }) {
  return (
    <div class={`reported${p.small ? ' small' : ''}`}>
      <span>You reported this {p.what}. It’s hidden for you.</span>
      <button type="button" class="linkish" onClick={p.onShow}>
        Show it
      </button>
    </div>
  );
}
