import { useEffect, useRef, useState } from 'preact/hooks';
import { countryDisplay, flagEmoji, OTHER_COUNTRY, searchCountries, usedCountries } from '../../../shared/domain/countries';
import { CheckIcon, ChevronDown } from '../icons';
import { cachedEntries, fetchEntries } from '../logEntries';
import { cachedProducts, fetchProducts } from '../products';

/** Countries on your Leaderboard products and Log entries (the Log's scope), for the Used section. */
async function usedCodes(): Promise<(string | null)[]> {
  const [products, entries] = await Promise.all([cachedProducts() ?? fetchProducts(), cachedEntries() ?? fetchEntries()]);
  return [...products.map((p) => p.country), ...entries.map((e) => e.country)];
}

// Whether a row is under a finger: a phone can take focus from the box as the finger lands, before the
// tap's click, and that must not close the list under it (as NameSuggestions).
let pressing = false;
const released = () => setTimeout(() => (pressing = false), 300);

/**
 * The Country field (D16; inline since D81, the owner: "i dont want when you choose a country for it to
 * take you to a whole seperate page… just a drop down underneath"). A box you can type in, with the
 * flag of the chosen country; tapping it opens the list right under it, in the form: Used first, then
 * every country (Not set first, Other… last). Typing narrows it (names, word starts and nicknames, D16);
 * no match offers "Use '…' as Other". A tap picks and closes the keyboard; Enter picks the best match;
 * Escape, or leaving the box, closes it unchanged.
 * `onChange(country, otherText)` — otherText is given only by "Use '…' as Other".
 */
export function CountryField(p: { id: string; label: string; value: string | null; otherText: string | null; onChange: (country: string | null, otherText?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [used, setUsed] = useState<{ code: string; name: string }[] | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const quiet = useRef(false); // a focus we make ourselves doesn't open the list
  const shown = p.value === OTHER_COUNTRY ? null : countryDisplay(p.value, null);
  const name = p.value === OTHER_COUNTRY ? 'Other' : (shown?.name ?? '');
  const listId = `${p.id}-list`;

  useEffect(() => {
    if (!open || used) return;
    let live = true;
    usedCodes()
      .then((codes) => live && setUsed(usedCountries(codes)))
      .catch(() => live && setUsed([])); // No Used section if your data can't load.
    return () => {
      live = false;
    };
  }, [open]);

  // Opened, the box moves up near the top of the screen, so the list fits above the iPhone keyboard
  // (again once the keyboard has come up and the visible area has shrunk).
  useEffect(() => {
    if (!open) return;
    const lift = () => box.current?.scrollIntoView({ block: 'start' });
    const frame = requestAnimationFrame(lift);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', lift);
    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener('resize', lift);
    };
  }, [open]);

  // A tap anywhere outside closes it too (a phone may not move focus on a tap, or may already have).
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!(e.target instanceof Node && box.current?.contains(e.target))) close();
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [open]);

  const show = () => {
    if (quiet.current) return;
    setQ('');
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setQ('');
  };
  const backToBox = () => {
    quiet.current = true;
    input.current?.focus();
    quiet.current = false;
  };
  const pick = (country: string | null, other: string | undefined, fromKeyboard: boolean) => {
    pressing = false;
    p.onChange(country, other);
    close();
    // A tap is done with the box, so the keyboard goes; from a keyboard, back to the box.
    if (fromKeyboard) backToBox();
    else input.current?.blur();
  };

  const typed = q.trim();
  const matches = searchCountries(q);

  const row = (key: string, code: string | null, label: string, flag?: string, other?: string) => {
    const selected = !other && (p.value ?? null) === code;
    return (
      <li key={key}>
        <button
          type="button"
          class={`cp-row${other ? ' cp-use' : ''}`}
          aria-current={selected ? 'true' : undefined}
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse') e.preventDefault(); // keep focus in the box
            pressing = true;
          }}
          onPointerUp={released}
          onPointerCancel={released}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => pick(code, other, e.detail === 0)}
        >
          {flag && (
            <span class="flag" aria-hidden="true">
              {flag}
            </span>
          )}
          <span class="nm">{label}</span>
          {selected && <CheckIcon class="tick" />}
        </button>
      </li>
    );
  };

  return (
    <div
      class="field cfield"
      ref={box}
      onFocusOut={(e) => {
        const to = e.relatedTarget;
        if ((to instanceof Node && box.current?.contains(to)) || pressing) return;
        close();
      }}
    >
      <label for={p.id}>{p.label}</label>
      <div class={`cbox${shown?.flag && !open ? ' has-flag' : ''}`}>
        {shown?.flag && !open && (
          <span class="flag" aria-hidden="true">
            {shown.flag}
          </span>
        )}
        <input
          ref={input}
          id={p.id}
          class="input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={open ? q : name}
          placeholder={open ? 'Type to search' : 'Not set'}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellcheck={false}
          enterKeyHint="done"
          onFocus={show}
          onClick={() => !open && show()}
          onInput={(e) => {
            setQ(e.currentTarget.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && open) {
              e.preventDefault();
              close();
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (!typed) close();
              else if (matches[0]) pick(matches[0].code, undefined, true);
              else pick(OTHER_COUNTRY, typed, true);
            }
          }}
        />
        <ChevronDown />
      </div>
      {open && (
        <div class="cdrop" id={listId} role="group" aria-label="Countries">
          {!typed && used && used.length > 0 && (
            <section aria-label="Used">
              <h3 class="cap">Used</h3>
              <ul>{used.map((c) => row(`used-${c.code}`, c.code, c.name, flagEmoji(c.code)))}</ul>
            </section>
          )}
          <section aria-label={typed ? 'Matching countries' : 'All countries'}>
            {!typed && used && used.length > 0 && <h3 class="cap">All countries</h3>}
            <ul>
              {!typed && row('none', null, 'Not set')}
              {matches.map((c) => row(c.code, c.code, c.name, flagEmoji(c.code)))}
              {typed && matches.length === 0 && (
                <>
                  <li class="cp-empty">No matching countries</li>
                  {row('use', OTHER_COUNTRY, `Use “${typed}” as Other`, undefined, typed)}
                </>
              )}
              {!(typed && matches.length === 0) && row('other', OTHER_COUNTRY, 'Other…')}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
