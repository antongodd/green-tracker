import { useEffect, useState } from 'preact/hooks';
import { formatScore } from '../../../shared/domain/format';
import type { WantKind } from '../../../shared/domain/wants';
import { ApiError, errorText } from '../api';
import { strainFriends, theirStrainz, type StrainFriend } from '../people';
import { EmptyCard } from './EmptyCard';
import { Skeleton } from './Skeleton';
import { linkTo } from '../router';
import { addWant } from '../wants';
import { photoOf } from '../screens/People';
import { Avatar } from './Avatar';
import { useMe } from './Duel';

// Friends on Strainz (D94): who of the people you follow has tried a strain, and adding a friend's strain or source to
// your own Want to try list.

const enc = encodeURIComponent;

/** "Friends who've tried it": each friend's photo, @name, what they had and their score; tap to open their product. */
export function FriendsTried(p: { name: string }) {
  const [friends, setFriends] = useState<StrainFriend[] | null>(null);
  useEffect(() => {
    let live = true;
    strainFriends(p.name)
      .then((f) => live && setFriends(f))
      .catch(() => live && setFriends([]));
    return () => {
      live = false;
    };
  }, [p.name]);
  if (!friends?.length) return null;
  return (
    <section class="friends-tried" aria-labelledby="friends-tried-h">
      <h2 id="friends-tried-h" class="group-h wrap strain-group">
        <span class="gname">Friends who’ve tried it</span>
        <span class="n num">{new Set(friends.map((f) => f.person.username)).size}</span>
      </h2>
      <div class="wrap">
        <ul class="list ftried">
          {friends.map((f) => {
            const href = `/u/${enc(f.person.username)}/p/${enc(f.productId)}`;
            return (
              <li key={f.productId}>
                <a href={href} onClick={linkTo(href)} aria-label={`@${f.person.username}, ${f.kind}${f.source ? `, ${f.source}` : ''}, ${f.score === null ? 'not rated' : `score ${formatScore(f.score)}`}`}>
                  <Avatar username={f.person.username} src={photoOf(f.person)} />
                  <span class="ft-text">
                    <span class="ft-n">@{f.person.username}</span>
                    <span class="ft-m">{[f.kind, f.source].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span class="ft-s num">{f.score === null ? '–' : formatScore(f.score)}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/**
 * "+ Want to try" for a friend's strain or source (D94): adds it to your own list with the note "From @them". Says
 * "You've tried it" when you have, and "On your list" when it's already there. They're never told.
 */
export function AddWant(p: { kind: WantKind; name: string; from: string; tried?: boolean; big?: boolean }) {
  const [state, setState] = useState<'idle' | 'busy' | 'added' | 'listed'>('idle');
  const [error, setError] = useState('');
  const cls = p.big ? 'btn primary add-want' : 'add-want sm';
  if (p.tried) return <span class={`${cls} tried`}>You’ve tried it</span>;
  if (state === 'added' || state === 'listed')
    return (
      <span class={`${cls} done`} role="status">
        {state === 'added' ? '✓ On your Want to try' : 'On your list'}
      </span>
    );
  const add = async () => {
    setState('busy');
    setError('');
    try {
      await addWant({ kind: p.kind, name: p.name, note: `From @${p.from}` });
      setState('added');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) return setState('listed');
      setError(errorText(e));
      setState('idle');
    }
  };
  return (
    <>
      <button type="button" class={cls} disabled={state === 'busy'} onClick={add} aria-label={p.big ? undefined : `Add ${p.name} to my Want to try`}>
        {p.big ? '+ Add to my Want to try' : '+ Want to try'}
      </button>
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

/**
 * A friend's Strainz page (D94): strains you've both tried (both averages, the higher one green), the ones only they've
 * tried, and their Want to try lists when they've switched them on. Each of theirs can go on your own list.
 */
export function TheirStrainz(p: { username: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof theirStrainz>> | null>(null);
  const me = useMe();
  const [error, setError] = useState('');
  useEffect(() => {
    theirStrainz(p.username)
      .then(setData)
      .catch((e) => setError(errorText(e)));
  }, [p.username]);
  const them = `@${p.username}`;
  if (error) return <p class="error wrap">{error}</p>;
  if (!data) return <Skeleton kind="board" />;
  const { both, onlyThem } = data.comparison;
  const wants = data.wants ?? [];
  const strainWants = wants.filter((w) => w.kind === 'strain');
  const sourceWants = wants.filter((w) => w.kind === 'source');
  const youHigher = both.filter((b) => b.yours !== null && b.theirs !== null && b.yours > b.theirs).length;
  const theyHigher = both.filter((b) => b.yours !== null && b.theirs !== null && b.theirs > b.yours).length;
  const product = (id: string) => `/u/${enc(p.username)}/p/${enc(id)}`;
  const score = (v: number | null) => (v === null ? '–' : formatScore(v));
  if (!both.length && !onlyThem.length && !wants.length)
    return (
      <EmptyCard art="shared" title="Nothing to compare yet">
        <p>{them} hasn’t shared any strains with you.</p>
      </EmptyCard>
    );
  return (
    <div class="their-strainz">
      {both.length > 0 && (
        <section aria-labelledby="ts-both">
          <h2 id="ts-both" class="group-h wrap strain-group">
            <span class="gname">You’ve both tried</span>
            <span class="n num">{both.length}</span>
          </h2>
          <div class="wrap">
            <table class="list vs-both">
              <caption class="visually-hidden">Strains you’ve both tried: your average (@{me.username}) and {them}’s</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span class="visually-hidden">Strain</span>
                  </th>
                  <th scope="col" class="vs-who">
                    <Avatar username={me.username} src={me.src} />
                    <span class="visually-hidden">@{me.username}</span>
                  </th>
                  <th scope="col" class="vs-who">
                    <Avatar username={p.username} src={data.person.photo ? photoOf(data.person) : undefined} />
                    <span class="visually-hidden">{them}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {both.map((b) => {
                  const win = b.yours === null || b.theirs === null || b.yours === b.theirs ? null : b.yours > b.theirs ? 'you' : 'them';
                  return (
                    <tr key={b.name}>
                      <th scope="row">
                        <a href={product(b.productId)} onClick={linkTo(product(b.productId))}>
                          {b.name}
                        </a>
                      </th>
                      <td class={`num${win === 'you' ? ' win' : ''}`}>
                        {score(b.yours)}
                        {win === 'you' && <span class="visually-hidden"> (higher)</span>}
                      </td>
                      <td class={`num${win === 'them' ? ' win' : ''}`}>
                        {score(b.theirs)}
                        {win === 'them' && <span class="visually-hidden"> (higher)</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p class="footnote vs-foot">
              You rate higher on {youHigher}, {them} on {theyHigher}. Your score is on the left; the higher one is green.
            </p>
          </div>
        </section>
      )}
      {onlyThem.length > 0 && (
        <WantRows id="ts-only" title={`Only ${them} has tried`} items={onlyThem.map((s) => ({ key: s.name, name: s.name, sub: `${them}: ${score(s.average)}${s.count > 1 ? ` · ×${s.count}` : ''}`, href: product(s.productId), kind: 'strain' as const, tried: false }))} from={p.username} />
      )}
      {strainWants.length > 0 && <WantRows id="ts-want" title={`On ${them}’s Want to try`} items={strainWants.map((w) => ({ key: w.name, name: w.name, sub: w.tried ? 'You’ve had it' : 'Not tried by you yet', kind: 'strain' as const, tried: w.tried }))} from={p.username} />}
      {sourceWants.length > 0 && <WantRows id="ts-src" title={`On ${them}’s Sources to try`} items={sourceWants.map((w) => ({ key: w.name, name: w.name, sub: w.tried ? 'You’ve had something from here' : 'Not tried by you yet', kind: 'source' as const, tried: w.tried }))} from={p.username} />}
      {data.wants === null && <p class="footnote">{them}’s Want to try list is private.</p>}
    </div>
  );
}

/** A group of a friend's strains or sources, each with + Want to try. */
function WantRows(p: { id: string; title: string; from: string; items: { key: string; name: string; sub: string; href?: string; kind: WantKind; tried: boolean }[] }) {
  return (
    <section aria-labelledby={p.id}>
      <h2 id={p.id} class="group-h wrap strain-group">
        <span class="gname">{p.title}</span>
        <span class="n num">{p.items.length}</span>
      </h2>
      <div class="wrap">
        <ul class="list want-rows">
          {p.items.map((i) => (
            <li key={i.key}>
              <span class="wr-text">
                {i.href ? (
                  <a class="wr-n" href={i.href} onClick={linkTo(i.href)}>
                    {i.name}
                  </a>
                ) : (
                  <span class="wr-n">{i.name}</span>
                )}
                <span class="wr-m">{i.sub}</span>
              </span>
              <AddWant kind={i.kind} name={i.name} from={p.from} tried={i.tried} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
