import type { ComponentChildren } from 'preact';
import { countryDisplay } from '../../../shared/domain/countries';
import { formatGBP, formatScore, formatUnitPrice, formatVFM } from '../../../shared/domain/format';
import { rankByCaption, type RankBy } from '../../../shared/domain/leaderboard';
import { headlinePrice, type Purchase } from '../../../shared/domain/money';
import type { Product } from '../../../shared/domain/product';
import { productType, STRAIN_TYPES } from '../../../shared/domain/productTypes';
import { overall } from '../../../shared/domain/ratings';
import { LockIcon, TypeMark } from '../icons';
import { linkTo } from '../router';
import { rememberRow } from '../scrollReturn';

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

export const asPurchases = (p: Product): Purchase[] => p.purchases.map((x) => ({ date: x.date, amount: x.amount, totalPaid: x.totalPaid, supplier: x.supplier, seq: x.seq }));

export function StrainTag(p: { strain: string | null }) {
  const s = STRAIN_TYPES.find((x) => x.key === p.strain);
  return s ? <span class={`tag ${s.key}`}>{s.label}</span> : null;
}

export function Thumb(p: { product: Product; class?: string }) {
  const def = productType(p.product.productType);
  // No photo: the type mark in accent; Other / Not set leave the square empty. (Photos: Phase 5.)
  return <div class={`thumb ${p.class ?? ''}`}>{def.icon && <TypeMark icon={def.icon} label={def.label} />}</div>;
}

/** Line 2 of a row: strain tag · flag · type mark (· lock on your own private products). */
export function Cluster(p: { product: Product; showLock?: boolean }) {
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
 * tried; else nothing. The price never truncates — only the Source does.
 */
export function MetaLine(p: { product: Product }) {
  const price = headlinePrice(asPurchases(p.product));
  const priceText = price === null ? null : formatUnitPrice(p.product.productType, price);
  const source = p.product.source;
  if (!priceText && !source) return p.product.dateTried ? <div class="meta">{formatIsoDate(p.product.dateTried)}</div> : null;
  return (
    <div class="meta">
      {priceText && <span class="price">{priceText}</span>}
      {priceText && source && <span class="sep">·</span>}
      {source && <span class="src">{source}</span>}
    </div>
  );
}

/** A ranked value as shown in the score block: scores 1dp, price £ 2dp, VFM 2dp. */
export function formatRankValue(rankBy: RankBy, value: number): string {
  if (rankBy === 'price') return formatGBP(value);
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
 * relabelled (`7.8 TASTE`, `£0.18 PRICE`); Overall by default.
 */
export function ProductRow(p: { product: Product; rank: number; podium: 1 | 2 | 3 | null; rankBy?: RankBy; value?: number | null; list?: string }) {
  const href = `/products/${p.product.id}`;
  const rankBy = p.rankBy ?? 'overall';
  const value = p.value !== undefined ? p.value : overall(p.product.productType, p.product.ratings);
  const open = (e: MouseEvent) => {
    if (p.list) rememberRow(p.list, p.product.id, e.currentTarget as HTMLElement);
    linkTo(href)(e);
  };
  return (
    <a class={`row${p.podium ? ` p${p.podium}` : ''}`} href={href} onClick={open} data-return={p.list ? `${p.list}:${p.product.id}` : undefined}>
      <span class="rk">{p.rank}</span>
      <Thumb product={p.product} />
      <div class="mid">
        <div class="name">{p.product.name}</div>
        <Cluster product={p.product} showLock />
        <MetaLine product={p.product} />
      </div>
      <Score value={value} label={rankByCaption(rankBy)} text={value === null ? undefined : formatRankValue(rankBy, value)} />
    </a>
  );
}
