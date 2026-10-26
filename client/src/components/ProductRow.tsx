import type { ComponentChildren } from 'preact';
import { countryDisplay } from '../../../shared/domain/countries';
import { formatPerUnit, formatScore, formatUnitPrice, formatVFM } from '../../../shared/domain/format';
import { heatStyle } from '../heat';
import type { Band } from '../../../shared/domain/gems';
import { rankByCaption, type RankBy, type TypeFilter } from '../../../shared/domain/leaderboard';
import { headlinePrice, latestPurchase, unitPricePaid, type Purchase } from '../../../shared/domain/money';
import { useCurrency } from '../money';
import { photoUrl } from '../../../shared/domain/photo';
import type { Product } from '../../../shared/domain/product';
import { productType, STRAIN_TYPES } from '../../../shared/domain/productTypes';
import { overall } from '../../../shared/domain/ratings';
import { LockIcon, TypeMark } from '../icons';
import { openRow } from '../router';
import { rememberRow } from '../scrollReturn';
import { Effects, RankCrown, rowClass, useAppearance } from './Gems';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** `2026-08-12` → `12 Aug 2026`. Dates are calendar days: no time zone involved. */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m! - 1]} ${y}`;
}

export const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const asPurchases = (p: Product): Purchase[] =>
  p.purchases.map((x) => ({ date: x.date, amount: x.amount, totalPaid: x.totalPaid, supplier: x.supplier, seq: x.seq, currency: x.currency, rate: x.rate }));

export function StrainTag(p: { strain: string | null }) {
  const s = STRAIN_TYPES.find((x) => x.key === p.strain);
  return s ? <span class={`tag ${s.key}`}>{s.label}</span> : null;
}

/** What a row needs to draw a product — your own, or one shared with you by someone you follow. */
export type RowProduct = Pick<Product, 'id' | 'name' | 'productType' | 'strainType' | 'country' | 'countryOther'> & {
  photos: { id: string; version: string; cutout?: boolean }[];
  private?: boolean;
};

export function Thumb(p: { product: RowProduct; class?: string }) {
  const def = productType(p.product.productType);
  const first = p.product.photos[0];
  // The first photo's thumbnail; no photo → the type mark in accent; Other / Not set → empty.
  return (
    <div class={`thumb${first?.cutout ? ' cut' : ''} ${p.class ?? ''}`}>
      {first ? <img src={photoUrl(first, 'thumb')} alt="" loading="lazy" decoding="async" /> : def.icon && <TypeMark icon={def.icon} label={def.label} />}
    </div>
  );
}

/** Line 2 of a row: strain tag · flag · type mark (· lock on your own private products). */
export function Cluster(p: { product: RowProduct; showLock?: boolean }) {
  const def = productType(p.product.productType);
  const country = countryDisplay(p.product.country, p.product.countryOther);
  return (
    <div class="cluster">
      <StrainTag strain={p.product.strainType} />
      {country?.flag && (
        <span class="flag" role="img" aria-label={country.name}>
          {country.flag}
        </span>
      )}
      {def.icon && <TypeMark icon={def.icon} label={def.label} />}
      {p.showLock && p.product.private && <LockIcon class="lock" label="Private" />}
    </div>
  );
}

/**
 * Metadata line (brief §10.1): price · Source; price or Source alone; else date
 * tried; else nothing. The price never truncates — only the Source does. D66: the price is in
 * your main currency; bought in another, what you paid follows it, smaller.
 */
export function MetaLine(p: { product: Product; perGram?: boolean }) {
  const main = useCurrency();
  const purchases = asPurchases(p.product);
  const price = headlinePrice(purchases);
  const latest = latestPurchase(purchases);
  const paid = price !== null && latest?.currency && latest.currency !== main ? unitPricePaid(latest) : null;
  const priceText = price === null ? null : formatUnitPrice(p.product.productType, price, main);
  const source = p.product.source;
  if (!priceText && !source) return p.product.dateTried ? <div class="meta">{formatIsoDate(p.product.dateTried)}</div> : null;
  // D67: ranked by Price across all types, an edible's score is the price of 20mg; this says so.
  const per = p.perGram && priceText ? productType(p.product.productType).unit : null;
  return (
    <div class="meta">
      {per && per.perGram !== 1 && (
        <>
          <span class="per">
            per {per.perGram}
            {per.amount}
          </span>
          <span class="sep">·</span>
        </>
      )}
      {priceText && <span class="price">{priceText}</span>}
      {paid !== null && <span class="paid">{formatUnitPrice(p.product.productType, paid, latest!.currency!)}</span>}
      {priceText && source && <span class="sep">·</span>}
      {source && <span class="src">{source}</span>}
    </div>
  );
}

/** A ranked value as shown in the score block: scores 1dp, price 2dp in your main currency, VFM 2dp. */
export function formatRankValue(rankBy: RankBy, value: number, currency: string): string {
  if (rankBy === 'price') return formatPerUnit(value, currency);
  if (rankBy === 'vfm') return formatVFM(value);
  return formatScore(value);
}

export function Score(p: { value: number | null; label?: string; text?: string }) {
  if (p.value === null) {
    return (
      <div class="score unrated">
        <b>–</b>
        <span class="cap">Unrated</span>
      </div>
    );
  }
  return (
    <div class="score">
      <b>{p.text ?? formatScore(p.value)}</b>
      <span class="cap">{p.label ?? 'Overall'}</span>
    </div>
  );
}

/**
 * The Leaderboard / Archive row (brief §6.1). The score shows the ranked value,
 * relabelled (`7.8 TASTE`, `£0.18 PRICE`); Overall by default. `meta` replaces the
 * metadata line (a brand's page shows Brand / Bought here there, D59).
 */
export function ProductRow(p: { product: Product; rank: number; band: Band | null; first: boolean; rankBy?: RankBy; filter?: TypeFilter; value?: number | null; list?: string; meta?: ComponentChildren }) {
  const appearance = useAppearance();
  const currency = useCurrency();
  const href = `/products/${p.product.id}`;
  const rankBy = p.rankBy ?? 'overall';
  const value = p.value !== undefined ? p.value : overall(p.product.productType, p.product.ratings);
  const open = (e: MouseEvent) => {
    if (p.list) rememberRow(p.list, p.product.id, e.currentTarget as HTMLElement);
    openRow(e, href);
  };
  return (
    <a class={`row${rowClass(p, appearance)}`} {...heatStyle(p.band, rankBy, value)} href={href} onClick={open} data-return={p.list ? `${p.list}:${p.product.id}` : undefined}>
      <Effects band={p.band} appearance={appearance} />
      <span class="rk">
        <RankCrown look={p} appearance={appearance} />
        {p.rank}
      </span>
      <Thumb product={p.product} />
      <div class="mid">
        <div class="name">{p.product.name}</div>
        <Cluster product={p.product} showLock />
        {p.meta ?? <MetaLine product={p.product} perGram={rankBy === 'price' && p.filter === 'all'} />}
      </div>
      <Score value={value} label={rankByCaption(rankBy)} text={value === null ? undefined : formatRankValue(rankBy, value, currency)} />
    </a>
  );
}
