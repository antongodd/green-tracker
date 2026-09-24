import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { countryDisplay, flagEmoji, OTHER_COUNTRY, searchCountries, usedCountries } from '../../../shared/domain/countries';
import { CheckIcon, ChevronDown, SearchIcon } from '../icons';
import { cachedEntries, fetchEntries } from '../logEntries';
import { cachedProducts, fetchProducts } from '../products';

/** Countries on your Leaderboard products and Log entries (the Log's scope), for the Used section. */
async function usedCodes(): Promise<(string | null)[]> {
  const [products, entries] = await Promise.all([cachedProducts() ?? fetchProducts(), cachedEntries() ?? fetchEntries()]);
  return [...products.map((p) => p.country), ...entries.map((e) => e.country)];
}

/**
 * iOS only opens the keyboard for a focus made during the tap itself, and the
 * panel's search box doesn't exist yet then. So the tap focuses a throwaway
 * input, and the panel moves focus on to its search box once drawn (the
 * keyboard stays up when focus moves between inputs).
 */
function holdKeyboard(): HTMLInputElement {
  const el = document.createElement('input');
  el.setAttribute('aria-hidden', 'true');
  el.tabIndex = -1;
  el.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0';
  document.body.appendChild(el);
  el.focus();
  return el;
}

/**
 * The Country field (D16): shows the flag and name; tapping opens a full-screen,
 * searchable list. Replaces the native select for Country only.
 * `onChange(country, otherText)` — otherText is given only by "Use '…' as Other".
 */
export function CountryField(p: { id: string; label: string; value: string | null; otherText: string | null; onChange: (country: string | null, otherText?: string) => void }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const keyboard = useRef<HTMLInputElement | null>(null);
  const shown = p.value === OTHER_COUNTRY ? null : countryDisplay(p.value, null);

  function close() {
    setOpen(false);
    button.current?.focus();
  }

  return (
    <div class="field">
      <label for={p.id}>{p.label}</label>
      <div class="select">
        <button
          type="button"
          id={p.id}
          ref={button}
          class="country-btn"
          aria-haspopup="dialog"
          onClick={() => {
            keyboard.current = holdKeyboard();
            setOpen(true);
          }}
        >
          {shown?.flag && (
            <span class="flag" aria-hidden="true">
              {shown.flag}
            </span>
          )}
          <span class="nm">{p.value === OTHER_COUNTRY ? 'Other' : (shown?.name ?? 'Not set')}</span>
        </button>
        <ChevronDown />
      </div>
      {open && (
        <CountryPanel
          value={p.value}
          keyboard={keyboard}
          onCancel={close}
          onPick={(country, other) => {
            p.onChange(country, other);
            close();
          }}
        />
      )}
    </div>
  );
}

function CountryPanel(p: { value: string | null; keyboard: { current: HTMLInputElement | null }; onPick: (country: string | null, otherText?: string) => void; onCancel: () => void }) {
  const [q, setQ] = useState('');
  const [used, setUsed] = useState<{ code: string; name: string }[]>([]);
  const [height, setHeight] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    input.current?.focus();
    p.keyboard.current?.remove();
    p.keyboard.current = null;
  }, []);

  // Fit the panel above the iPhone keyboard, so the end of the list can be reached.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const fit = () => setHeight(vv.height);
    fit();
    vv.addEventListener('resize', fit);
    return () => vv.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    let live = true;
    usedCodes()
      .then((codes) => live && setUsed(usedCountries(codes)))
      .catch(() => {}); // No Used section if your data can't load.
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') p.onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const typed = q.trim();
  const matches = searchCountries(q);

  function onEnter(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!typed) return;
    if (matches[0]) p.onPick(matches[0].code);
    else p.onPick(OTHER_COUNTRY, typed);
  }

  const row = (key: string, code: string | null, label: string, flag?: string) => {
    const selected = (p.value ?? null) === code;
    return (
      <li key={key}>
        <button type="button" class="cp-row" aria-current={selected ? 'true' : undefined} onClick={() => p.onPick(code)}>
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
    <div class="cpicker" role="dialog" aria-modal="true" aria-label="Choose a country" style={height ? { height: `${height}px` } : undefined}>
      <div class="cp-top">
        <button type="button" class="hbtn" onClick={p.onCancel}>
          Cancel
        </button>
        <strong>Country</strong>
        <span />
      </div>
      <div class="cp-search">
        <label class="search">
          <SearchIcon />
          <span class="visually-hidden">Search countries</span>
          <input
            ref={input}
            type="search"
            value={q}
            onInput={(e) => setQ(e.currentTarget.value)}
            onKeyDown={onEnter}
            placeholder="Search countries"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellcheck={false}
            enterKeyHint="done"
          />
        </label>
      </div>
      <div class="cp-list">
        {!typed && used.length > 0 && (
          <section aria-label="Used">
            <h2 class="cap">Used</h2>
            <ul>{used.map((c) => row(`used-${c.code}`, c.code, c.name, flagEmoji(c.code)))}</ul>
          </section>
        )}
        <section aria-label={typed ? 'Matching countries' : 'All countries'}>
          {!typed && used.length > 0 && <h2 class="cap">All countries</h2>}
          <ul>
            {!typed && row('none', null, 'Not set')}
            {matches.map((c) => row(c.code, c.code, c.name, flagEmoji(c.code)))}
            {typed && matches.length === 0 && (
              <>
                <li class="cp-empty">No matching countries</li>
                <li>
                  <button type="button" class="cp-row cp-use" onClick={() => p.onPick(OTHER_COUNTRY, typed)}>
                    <span class="nm">Use “{typed}” as Other</span>
                  </button>
                </li>
              </>
            )}
            {!(typed && matches.length === 0) && row('other', OTHER_COUNTRY, 'Other…')}
          </ul>
        </section>
      </div>
    </div>
  );
}
