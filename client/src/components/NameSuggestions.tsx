import { suggestNames, type UsedName } from '../../../shared/domain/names';

// Whether a suggestion is under a finger. A phone can take focus from the box as the finger lands,
// before the tap's click; leaving the box then must not close the suggestions under that finger.
let pressing = false;
const released = () => setTimeout(() => (pressing = false), 300);

/**
 * Whether the box `id` is losing focus to its own suggestions (moving into them, or one is being
 * pressed), so it isn't really being left.
 */
export const intoSuggestions = (to: EventTarget | null, id: string): boolean => (to instanceof Element && !!to.closest(`.suggest[data-for="${id}"]`)) || pressing;

/**
 * Brands and suppliers (D59, option A of the mockups): while you type in Source or a purchase's
 * Supplier, the names you've already used show under the box as buttons; one tap fills it and the
 * keyboard stays up (the tap never takes focus from the box). A near miss says "Did you mean";
 * a name you use spelt differently says which spelling it will be saved as.
 */
export function NameSuggestions(p: { for: string; label: string; typed: string; used: readonly UsedName[]; first?: string | null; onPick: (name: string) => void; onLeave: () => void }) {
  const s = suggestNames(p.used, p.typed, { first: p.first });
  if (!s.names.length && !s.savedAs) return null;
  return (
    <div
      class="suggest"
      data-for={p.for}
      role="group"
      aria-label={`Suggestions for ${p.label}`}
      onFocusOut={(e) => {
        const to = e.relatedTarget;
        if ((to instanceof Element && to.id === p.for) || intoSuggestions(to, p.for)) return;
        p.onLeave();
      }}
    >
      {s.savedAs && <p class="hint ok">Saved as “{s.savedAs}”, the name you already use</p>}
      {s.typo && <span class="suggest-cap">Did you mean</span>}
      {s.names.length > 0 && (
        <div class="chips">
          {s.names.map((n) => (
            <button
              type="button"
              class="pill chip"
              key={n.key}
              onPointerDown={(e) => {
                e.preventDefault();
                pressing = true;
              }}
              onPointerUp={released}
              onPointerCancel={released}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                pressing = false;
                p.onPick(n.name);
                document.getElementById(p.for)?.focus();
              }}
            >
              <span class="t">{n.name}</span>
              {n.products > 0 && (
                <span class="n" aria-hidden="true">
                  {n.products}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
