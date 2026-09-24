import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { filterOptions, rankByOptions, type RankBy, type TypeFilter } from '../../../shared/domain/leaderboard';
import { productType } from '../../../shared/domain/productTypes';
import { ChevronDown } from '../icons';

// Short forms, used only when the measured row doesn't fit (brief §6.4:
// full labels by default; abbreviate only what is measured not to fit).
const SHORT_RANK: Partial<Record<RankBy, string>> = { vfm: 'VFM', consistency: 'Consis.' };
const SHORT_PRICE: Record<string, string> = { g: 'Price/g', mg: 'Price/mg' };
const SHORT_TYPE: Partial<Record<TypeFilter, string>> = { concentrate: 'Conc.' };

function Pill(p: { id: string; name: string; label: string; active: boolean; value: string; options: { key: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <span class={`pill${p.active ? ' active' : ''}`}>
      <span class="pill-text" aria-hidden="true">
        <span class="k">{p.name}:</span> {p.label}
      </span>
      <ChevronDown />
      {/* A real, transparent native select, so iOS shows its own picker (brief §6.4). */}
      <select id={p.id} aria-label={p.name === 'Rank' ? 'Rank by' : 'Type'} value={p.value} onChange={(e) => p.onChange(e.currentTarget.value)}>
        {p.options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

/**
 * The control row under the header (P4: sticky). Rank by on the left (Leaderboard
 * only), Type on the right in the same place on every screen.
 */
export function ControlRow(p: { filter: TypeFilter; rankBy?: RankBy; money?: boolean; onFilter: (f: TypeFilter) => void; onRankBy?: (r: RankBy) => void }) {
  const row = useRef<HTMLDivElement>(null);
  // 0 = full labels, 1 = short Rank label, 2 = short Rank and Type labels.
  const [compact, setCompact] = useState(0);
  const key = `${p.filter}|${p.rankBy ?? ''}`;
  const measuredFor = useRef('');

  // Measure after layout and before paint; step down only as far as needed.
  useLayoutEffect(() => {
    const el = row.current;
    if (!el) return;
    if (measuredFor.current !== key) {
      measuredFor.current = key;
      if (compact !== 0) return setCompact(0);
    }
    if (el.scrollWidth > el.clientWidth + 1 && compact < 2) setCompact(compact + 1);
  });
  useLayoutEffect(() => {
    const onResize = () => {
      measuredFor.current = '';
      setCompact(0);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const typeOptions = filterOptions().map((o) => ({ key: o.key, label: o.key === 'all' ? o.label : `${productType(o.key).filterEmoji} ${o.label}` }));
  const typeLabel = filterOptions().find((o) => o.key === p.filter)!.label;
  let rank: { options: { key: string; label: string }[]; label: string } | null = null;
  if (p.rankBy && p.onRankBy) {
    const options = rankByOptions(p.filter, { money: p.money ?? true });
    const full = options.find((o) => o.key === p.rankBy)?.label ?? 'Overall';
    const short = p.rankBy === 'price' && p.filter !== 'all' ? SHORT_PRICE[productType(p.filter).unit.amount] : SHORT_RANK[p.rankBy];
    rank = { options, label: compact >= 1 && short ? short : full };
  }

  return (
    <div class="controls" ref={row}>
      {rank && p.rankBy && (
        <Pill id="rank-by" name="Rank" label={rank.label} active={p.rankBy !== 'overall'} value={p.rankBy} options={rank.options} onChange={(v) => p.onRankBy!(v as RankBy)} />
      )}
      <span class="controls-right">
        <Pill
          id="type-filter"
          name="Type"
          label={compact >= 2 && SHORT_TYPE[p.filter] ? SHORT_TYPE[p.filter]! : typeLabel}
          active={p.filter !== 'all'}
          value={p.filter}
          options={typeOptions}
          onChange={(v) => p.onFilter(v as TypeFilter)}
        />
      </span>
    </div>
  );
}

/** Stats tiles (brief §6.3): three equal tiles, value over caption. */
export function Tiles(p: { tiles: { value: string; label: string }[] }) {
  return (
    <div class={`tiles${p.tiles.length === 2 ? ' two' : ''}`}>
      {p.tiles.map((t) => (
        <div class="tile" key={t.label}>
          <b>{t.value}</b>
          <span class="cap">{t.label}</span>
        </div>
      ))}
    </div>
  );
}
