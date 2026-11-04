import { useState } from 'preact/hooks';
import { WANT_LIMITS, type Want, type WantKind } from '../../../shared/domain/wants';
import { errorText } from '../api';
import { addWant, removeWant } from '../wants';
import { EmptyCard } from './EmptyCard';
import { Skeleton } from './Skeleton';

// Want to try (D92): the halves (Tried | Want to try / To try), the sheet that adds one and the list, shared by
// Strainz (strains) and Sources (sources).

export type Half = 'tried' | 'want';

/** Tried | Want to try (D92), like People's halves. */
export function Halves(p: { label: string; value: Half; tried: number; want: number; wantLabel: string; onChange: (h: Half) => void }) {
  return (
    <div class="seg two halves" role="tablist" aria-label={p.label}>
      {(
        [
          ['tried', 'Tried', p.tried],
          ['want', p.wantLabel, p.want],
        ] as const
      ).map(([key, label, n]) => (
        <button key={key} type="button" role="tab" aria-selected={p.value === key} class={p.value === key ? 'on' : ''} onClick={() => p.onChange(key)}>
          {label}
          <span class="n num">{n}</span>
        </button>
      ))}
    </div>
  );
}

/** The Want to try sheet (D92): a name and an optional note. `known` says when you've already tried it. */
export function WantSheet(p: { kind: WantKind; known?: (name: string) => string | null; onClose: () => void; onAdded: (w: Want) => void }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const strain = p.kind === 'strain';
  const hint = name.trim() ? (p.known?.(name) ?? null) : null;
  const add = async (e: Event) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      p.onAdded(await addWant({ kind: p.kind, name, note: note.trim() || null }));
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };
  return (
    <>
      <div class="scrim" onClick={p.onClose} />
      <form class="sheet want-sheet" role="dialog" aria-modal="true" aria-labelledby="want-title" onSubmit={add}>
        <div class="grp pad">
          <h2 id="want-title" class="lbl">
            {strain ? 'A strain to try' : 'A source to try'}
          </h2>
          <p class="small">{strain ? 'It leaves your list by itself when you add a product with this name.' : 'It leaves your list by itself when you add a product from it, or bought there.'}</p>
          <div class="field">
            <label for="want-name">{strain ? 'Strain' : 'Brand, grower or seller'}</label>
            <input id="want-name" class="input" type="text" autoComplete="off" maxLength={WANT_LIMITS.name} placeholder={strain ? 'e.g. Runtz' : 'e.g. Cloud Nine'} value={name} onInput={(e) => setName(e.currentTarget.value)} autoFocus />
            {hint && <span class="small hint">{hint}</span>}
          </div>
          <div class="field">
            <label for="want-note">Note (optional)</label>
            <input id="want-note" class="input" type="text" autoComplete="off" maxLength={WANT_LIMITS.note} placeholder={strain ? 'Where you heard of it' : 'What to try there'} value={note} onInput={(e) => setNote(e.currentTarget.value)} />
          </div>
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          <div class="btn-row">
            <button type="button" class="btn secondary" onClick={p.onClose}>
              Cancel
            </button>
            <button type="submit" class="btn primary" disabled={busy || !name.trim()}>
              {busy ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

/** One Want to try list: newest first, each with its note and a Remove button. Private: says so under it. */
export function WantList(p: { kind: WantKind; wants: Want[] | null; error: string; onAdd: () => void }) {
  const [error, setError] = useState('');
  const mine = (p.wants ?? []).filter((w) => w.kind === p.kind);
  const strain = p.kind === 'strain';
  if (!p.wants) return p.error ? <p class="error wrap">{p.error}</p> : <Skeleton kind="people" />;
  return (
    <div class="wrap stack">
      {mine.length === 0 ? (
        <EmptyCard art="filter" title={strain ? 'No strains to try yet' : 'No sources to try yet'}>
          <p>{strain ? 'Heard about a strain you want to look out for? Add it here and it ticks itself off when you try it.' : 'Heard about a brand, grower or seller you want to try? Add it here and it ticks itself off when you try it.'}</p>
          <button type="button" class="btn primary" style={{ width: 'auto' }} onClick={p.onAdd}>
            {strain ? 'Add a strain to try' : 'Add a source to try'}
          </button>
        </EmptyCard>
      ) : (
        <ul class="list wants" aria-label={strain ? 'Strains to try' : 'Sources to try'}>
          {mine.map((w) => (
            <li key={w.id} class="want">
              <span class="w-text">
                <span class="w-name">{w.name}</span>
                {w.note && <span class="w-note">{w.note}</span>}
              </span>
              <button
                type="button"
                class="btn secondary sm"
                aria-label={`Remove ${w.name}`}
                onClick={() => {
                  setError('');
                  removeWant(w.id).catch((e) => setError(errorText(e)));
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
      <p class="footnote">Only you can see this list. {strain ? 'A strain leaves it by itself when you add a product with that name.' : 'A source leaves it by itself when you add a product from it.'}</p>
    </div>
  );
}

