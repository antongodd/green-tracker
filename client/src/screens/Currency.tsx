// Main currency (D66, 0.56.0; Settings → Money → Main currency). Every price shown together or
// compared is in it; each purchase keeps the currency you paid in. Changing it works every
// purchase out again in the new one, each at its day's rate (on the server, all at once).
import { useState } from 'preact/hooks';
import { COMMON_CURRENCIES, CURRENCIES, currencySign, type CurrencyDef } from '../../../shared/domain/currency';
import { errorText } from '../api';
import { BackButton, Header, Sheet, TabBar } from '../components/chrome';
import { clearEntryCache } from '../logEntries';
import { saveCurrency, useCurrency } from '../money';
import { clearProductCache } from '../products';
import { useSession } from '../session';

export function CurrencyScreen() {
  const { refresh } = useSession();
  const main = useCurrency();
  const [asking, setAsking] = useState<CurrencyDef | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function change(c: CurrencyDef) {
    setAsking(null);
    setBusy(true);
    setError('');
    try {
      await saveCurrency(c.code);
      // Every price is new: lists and pages load again.
      clearProductCache();
      clearEntryCache();
      await refresh();
    } catch (e) {
      setError(errorText(e));
      // The list is long: bring the reason into view.
      window.scrollTo({ top: 0 });
    }
    setBusy(false);
  }

  const group = (label: string, list: readonly CurrencyDef[]) => (
    <section aria-labelledby={`cur-${label}`}>
      <h2 class="lh cap" id={`cur-${label}`}>
        {label}
      </h2>
      <div class="wrap">
        <div class="list" role="radiogroup" aria-labelledby={`cur-${label}`}>
          {list.map((c) => (
            <label key={c.code} class="li sound-set cur-row">
              <span class="cur-sign" aria-hidden="true">
                {currencySign(c.code)}
              </span>
              <span class="main">
                <span>{c.name}</span>
                <span class="sub">{c.code}</span>
              </span>
              <input type="radio" class="radio" name="main-currency" value={c.code} checked={c.code === main} disabled={busy} onClick={(e) => (e.preventDefault(), c.code !== main && setAsking(c))} />
            </label>
          ))}
        </div>
      </div>
    </section>
  );

  return (
    <>
      <Header title="Main currency" left={<BackButton to="/more" />} />
      <main class="screen privacy currency-screen">
        <div class="wrap">
          <p class="footnote priv-foot">Prices shown together are in this currency, so everything can be compared. Each purchase keeps the currency you paid in.</p>
        </div>
        {error && (
          <p class="error pv-error" role="alert">
            {error}
          </p>
        )}
        {busy && (
          <div class="wrap">
            <p class="footnote priv-foot" role="status">
              Working out your prices again…
            </p>
          </div>
        )}
        {group(
          'Usual',
          CURRENCIES.filter((c) => (COMMON_CURRENCIES as readonly string[]).includes(c.code)),
        )}
        {group(
          'More',
          CURRENCIES.filter((c) => !(COMMON_CURRENCIES as readonly string[]).includes(c.code)),
        )}
      </main>
      <TabBar active="more" />
      {asking && (
        <Sheet
          title={`Use ${currencySign(asking.code)} for your prices?`}
          message={`Every price is worked out again in ${asking.name} (${asking.code}), each purchase at the rate for its day. Rates you typed in yourself are replaced.`}
          options={[{ label: `Use ${currencySign(asking.code)} ${asking.code}`, tick: true, onSelect: () => change(asking) }]}
          onCancel={() => setAsking(null)}
        />
      )}
    </>
  );
}
