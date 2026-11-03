import { useEffect, useState } from 'preact/hooks';
import type { Comparison, ComparedProduct } from '../../../shared/domain/compare';
import { formatScore } from '../../../shared/domain/format';
import { productType, type ProductTypeKey } from '../../../shared/domain/productTypes';
import type { PersonCard } from '../../../shared/domain/social';
import { errorText } from '../api';
import { BackButton, Header, TabBar } from '../components/chrome';
import { Duel, them as whoOf, useMe, type Who } from '../components/Duel';
import { InTheirLook } from '../components/Gems';
import { Avatar } from '../components/Avatar';
import { EmptyCard } from '../components/EmptyCard';
import { Skeleton } from '../components/Skeleton';
import * as api from '../people';
import { linkTo } from '../router';

// Compare boards (D82): your Leaderboard against a friend's, one card per subject (Anton's pick B),
// each side with its photo and @name (pick C). Worked out by the server from what they share with
// you; a card with nothing in it isn't shown at all (no empty box, no 0).

const enc = encodeURIComponent;
const score = (n: number | null) => (n === null ? '–' : formatScore(n));
const typeLabel = (key: ProductTypeKey | null, other?: string | null) => {
  if (!key || key === 'not_set') return null;
  const def = productType(key);
  return def.freeText ? other?.trim() || def.label : def.label;
};
const line = (p: { productType: ProductTypeKey; productTypeOther: string | null; source: string | null }) => [typeLabel(p.productType, p.productTypeOther), p.source].filter(Boolean).join(' · ');

/** A small face and a number, for the lists. */
function Chip(p: { who: Who; value: number | null; mine?: boolean }) {
  return (
    <span class={`your-chip${p.mine ? ' mine' : ''}`}>
      <Avatar username={p.who.username} src={p.who.src} size="xs" />
      <b>{score(p.value)}</b>
      <span class="visually-hidden"> @{p.who.username}</span>
    </span>
  );
}

function Top(p: { product: ComparedProduct | null }) {
  if (!p.product) return <span class="duel-text">Nothing rated</span>;
  return (
    <>
      <span class="duel-text name">{p.product.name}</span>
      <b class="duel-score">{score(p.product.score)}</b>
    </>
  );
}

export function Compare(p: { username: string }) {
  const me = useMe();
  const [data, setData] = useState<{ person: PersonCard; comparison: Comparison } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .compareWith(p.username)
      .then(setData)
      .catch((e) => setError(errorText(e)));
  }, [p.username]);
  const back = `/u/${enc(p.username)}`;
  const title = `@${me.username} vs @${data?.person.username ?? p.username}`;
  const c = data?.comparison;
  const they = data ? whoOf(data.person) : { username: p.username };
  const theirPage = (id: string) => `/u/${enc(p.username)}/p/${enc(id)}`;

  return (
    <InTheirLook username={p.username}>
      <Header title={title} leaf={false} left={<BackButton to={back} />} />
      <main class="screen compare">
        {!data && !error && <Skeleton kind="board" />}
        {error && (
          <div class="empty">
            <h2>Couldn’t compare</h2>
            <p>{error}</p>
          </div>
        )}
        {c && c.them.products === 0 && (
          <EmptyCard art="shared" title="Nothing to compare yet">
            <p>@{they.username} hasn’t shared any products.</p>
          </EmptyCard>
        )}
        {c && c.them.products > 0 && (
          <>
            <section class="sect" aria-label="Average">
              <span class="cap">Average</span>
              <Duel me={me} them={they}>
                {[
                  <>
                    <b class="duel-score">{score(c.you.average)}</b>
                    <span class="duel-sub">{c.you.products === 1 ? '1 product' : `${c.you.products} products`}</span>
                  </>,
                  <>
                    <b class="duel-score">{score(c.them.average)}</b>
                    <span class="duel-sub">{c.them.products === 1 ? '1 product' : `${c.them.products} products`}</span>
                  </>,
                ]}
              </Duel>
            </section>
            {(c.you.top || c.them.top) && (
              <section class="sect" aria-label="Number 1">
                <span class="cap">Number 1</span>
                <Duel me={me} them={they}>
                  {[<Top product={c.you.top} />, <Top product={c.them.top} />]}
                </Duel>
              </section>
            )}
            <section class="sect" aria-label="Favourites">
              <span class="cap">Favourites</span>
              <Duel me={me} them={they}>
                {[
                  <>
                    <span class="duel-text">{typeLabel(c.you.favouriteType) ?? '–'}</span>
                    {c.sourceShared && c.you.favouriteBrand && <span class="duel-sub">{c.you.favouriteBrand}</span>}
                  </>,
                  <>
                    <span class="duel-text">{typeLabel(c.them.favouriteType) ?? '–'}</span>
                    {c.sourceShared && c.them.favouriteBrand && <span class="duel-sub">{c.them.favouriteBrand}</span>}
                  </>,
                ]}
              </Duel>
              <p class="cmp-note">Type{c.sourceShared ? ' and brand' : ''} with the most products.</p>
            </section>
            {c.both.length > 0 && (
              <section class="sect" aria-label="You’ve both had">
                <span class="cap">You’ve both had</span>
                <ul class="cmp-list">
                  {c.both.map((b) => (
                    <li key={b.theirs.id}>
                      <a href={theirPage(b.theirs.id)} onClick={linkTo(theirPage(b.theirs.id))}>
                        <span class="cmp-name">
                          <b>{b.name}</b>
                          <span>{line(b)}</span>
                        </span>
                        <span class="cmp-chips">
                          <Chip who={me} value={b.yours.score} mine />
                          <Chip who={they} value={b.theirs.score} />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {c.brands.length > 0 && (
              <section class="sect" aria-label="Brands you’ve both tried">
                <span class="cap">Brands you’ve both tried</span>
                <ul class="cmp-list">
                  {c.brands.map((b) => (
                    <li key={b.name}>
                      <div>
                        <span class="cmp-name">
                          <b>{b.name}</b>
                          <span>
                            {b.you.products} and {b.them.products} {b.them.products === 1 && b.you.products === 1 ? 'product' : 'products'}
                          </span>
                        </span>
                        <span class="cmp-chips">
                          <Chip who={me} value={b.you.average} mine />
                          <Chip who={they} value={b.them.average} />
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {c.picks.length > 0 && (
              <section class="sect" aria-label={c.sourceShared ? 'Their top picks you haven’t tried' : 'Their top picks'}>
                <span class="cap">{c.sourceShared ? `@${they.username}’s top picks you haven’t tried` : `@${they.username}’s top picks`}</span>
                <ul class="cmp-list">
                  {c.picks.map((x) => (
                    <li key={x.id}>
                      <a href={theirPage(x.id)} onClick={linkTo(theirPage(x.id))}>
                        <span class="cmp-name">
                          <b>{x.name}</b>
                          <span>{line(x)}</span>
                        </span>
                        <span class="cmp-chips">
                          <Chip who={they} value={x.score} />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {!c.sourceShared && <p class="cmp-note out">@{they.username} doesn’t share brands, so we can’t tell which products you’ve both had.</p>}
            <p class="cmp-note out">Only what @{they.username} shares with followers. Nobody is told you compared.</p>
          </>
        )}
      </main>
      <TabBar active="feed" />
    </InTheirLook>
  );
}
