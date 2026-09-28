// The top of a product page (D27, 0.20.0): the "Poster". The first photo fills the top
// of the page edge to edge, running up behind the glass header, and the name, score,
// tags and price sit on its bottom over a dark fade. A cut-out floats in the upper part
// on a soft glow (so the text never covers it); no photo shows the type mark there.
// Shared by your product page and a friend's (which passes no price or flags).
// `.hero-photo` stays the Photo grows target (transitions.ts); styled in styles.css.
import type { ComponentChildren } from 'preact';
import { countryDisplay } from '../../../shared/domain/countries';
import { formatScore } from '../../../shared/domain/format';
import type { Podium, ViewState } from '../../../shared/domain/leaderboard';
import { productType } from '../../../shared/domain/productTypes';
import { TypeMark } from '../icons';
import { PhotoGlints, PodiumBadge } from './Podium';
import type { ShownPhoto } from './PhotoViewer';
import { StrainTag } from './ProductRow';

export function ProductHero(p: {
  name: string;
  productType: string;
  strainType: string | null;
  typeLabel: string | null;
  concentrateLabel: string | null;
  country: ReturnType<typeof countryDisplay>;
  overall: number | null;
  photo: ShownPhoto | null;
  onOpenPhoto: () => void;
  podium: Podium | null;
  view: ViewState;
  whose: 'your' | 'their';
  /** Headline price, already formatted (your own page only). */
  price?: string | null;
  /** Private / Archived notes (your own page only). */
  notes?: ComponentChildren;
}) {
  const def = productType(p.productType);
  const kind = !p.photo ? ' plain' : p.photo.cutout ? ' cut' : '';
  return (
    <div class={`poster${kind}`}>
      {p.photo ? (
        <button class={`hero-photo${p.photo.cutout ? ' cut' : ''}`} onClick={p.onOpenPhoto} aria-label="Open photos">
          {/* The thumbnail (already on the device) shows until the full photo arrives (D20). */}
          <span class="hero-under" style={{ backgroundImage: `url("${p.photo.thumb}")` }} />
          <img src={p.photo.image} alt="" />
          <PhotoGlints podium={p.podium} />
        </button>
      ) : (
        <div class="hero-photo">
          {def.icon && <TypeMark icon={def.icon} label={def.label} />}
          <PhotoGlints podium={p.podium} />
        </div>
      )}
      <div class="hero">
        <PodiumBadge podium={p.podium} view={p.view} whose={p.whose} />
        <div class="hero-head">
          <h1>{p.name}</h1>
          <div class={`hero-score${p.overall === null ? ' unrated' : ''}`}>
            <b>{p.overall === null ? '–' : formatScore(p.overall)}</b>
            <span class="cap">{p.overall === null ? 'Unrated' : 'Overall'}</span>
          </div>
        </div>
        <div class="hero-line">
          <StrainTag strain={p.strainType} />
          {p.typeLabel && <span>{p.typeLabel}</span>}
          {p.productType === 'concentrate' && p.concentrateLabel && <span>· {p.concentrateLabel}</span>}
          {p.country && (
            <span>
              · {p.country.flag ? `${p.country.flag} ` : ''}
              {p.country.name}
            </span>
          )}
        </div>
        {p.price && <div class="hero-price">{p.price}</div>}
        {p.notes}
      </div>
    </div>
  );
}
