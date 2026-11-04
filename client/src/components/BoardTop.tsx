import type { Band } from '../../../shared/domain/gems';
import { bandName, PRESETS } from '../../../shared/domain/gems';
import type { RankBy } from '../../../shared/domain/leaderboard';
import type { Product } from '../../../shared/domain/product';
import { photoUrl } from '../../../shared/domain/photo';
import { productType, STRAIN_TYPES } from '../../../shared/domain/productTypes';
import { useCurrency } from '../money';
import { openRow } from '../router';
import { formatRankValue } from './ProductRow';
import { useAppearance } from './Gems';

/**
 * Showcase (D87, the Leaderboard top that was the glass hero): your top three as big photo cards you swipe
 * through, each with its place, name, strain and Source, and its score in its colour band's colour. A card
 * opens the product, as its row does.
 */
export function Showcase(p: { rows: { product: Product; rank: number; value: number | null; band: Band | null }[]; rankBy: RankBy }) {
  const appearance = useAppearance();
  const currency = useCurrency();
  const top = p.rows.slice(0, 3);
  if (top.length === 0) return null;
  return (
    <section class="board-showcase" aria-label="Your top three">
      {top.map((r, i) => {
        const cover = r.product.photos[0];
        const href = `/products/${r.product.id}`;
        const strain = STRAIN_TYPES.find((t) => t.key === r.product.strainType)?.label;
        const what = [strain, r.product.source].filter(Boolean).join(' · ') || productType(r.product.productType).label;
        return (
          <a key={r.product.id} class={`sc-card${r.band ? ` band${r.band} pal-${appearance.preset}` : ''}`} href={href} onClick={(e) => openRow(e, href)}>
            {cover ? <img src={photoUrl(cover, 'cropped')} alt="" loading={i === 0 ? 'eager' : 'lazy'} decoding="async" class={cover.cutout ? 'cut' : undefined} /> : <span class="sc-none" aria-hidden="true" />}
            <span class="sc-cap">
              <span class="sc-t">
                <span class="sc-pos">#{r.rank}</span>
                <span class="sc-n">{r.product.name}</span>
                <span class="sc-m">{what}</span>
              </span>
              {r.value !== null && <b class="sc-s">{formatRankValue(p.rankBy, r.value, currency)}</b>}
            </span>
          </a>
        );
      })}
    </section>
  );
}

/**
 * Summary's bar (D87): how your scores spread over your colour set's four bands and "below", each part as
 * wide as its count, named underneath (as in Apple Fitness's summaries).
 */
export function Spread(p: { bands: (Band | null)[] }) {
  const { preset } = useAppearance();
  const count = (b: Band | null) => p.bands.filter((x) => x === b).length;
  const parts = ([4, 3, 2, 1] as Band[]).map((b) => ({ key: `band${b}`, cls: `band${b} pal-${preset}`, n: count(b), label: bandName(preset, b) })).filter((x) => x.n > 0);
  const below = count(null);
  if (below > 0) parts.push({ key: 'below', cls: 'below', n: below, label: 'Under 8' });
  if (parts.length === 0) return null;
  return (
    <div class="spread" aria-label={`How your scores spread: ${parts.map((x) => `${x.label} ${x.n}`).join(', ')} (${PRESETS[preset].label})`} role="img">
      <div class="spread-bar">
        {parts.map((x) => (
          <i key={x.key} class={x.cls} style={{ flexGrow: x.n }} />
        ))}
      </div>
      <div class="spread-leg" aria-hidden="true">
        {parts.map((x) => (
          <span key={x.key}>
            <i class={x.cls} />
            {x.label} · {x.n}
          </span>
        ))}
      </div>
    </div>
  );
}
