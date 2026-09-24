import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { PersonCard } from '../../../shared/domain/social';
import { errorText } from '../api';
import { BackButton, Header, Sheet, TabBar, type SheetOption } from '../components/chrome';
import { MoreIcon, SearchIcon } from '../icons';
import * as api from '../people';
import { linkTo, navigate } from '../router';
import { useSession } from '../session';

type Segment = 'requests' | 'followers' | 'following';
let lastSegment: Segment = 'requests';

export function Avatar(p: { username: string; large?: boolean }) {
  return (
    <span class={`av${p.large ? ' lg' : ''}`} aria-hidden="true">
      {[...p.username][0]!.toUpperCase()}
    </span>
  );
}

function PersonRow(p: { username: string; children?: ComponentChildren; note?: string }) {
  const href = `/u/${encodeURIComponent(p.username)}`;
  return (
    <div class="prow">
      <a class="who" href={href} onClick={linkTo(href)}>
        <Avatar username={p.username} />
        <span class="u">
          @{p.username}
          {p.note && <span class="small">{p.note}</span>}
        </span>
      </a>
      <span class="acts">{p.children}</span>
    </div>
  );
}

/** Follow / Requested / Following, as on the mockup (P6). */
function RelationButton(p: { person: PersonCard; onChange: (next: PersonCard) => void }) {
  const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<PersonCard>) => {
    setBusy(true);
    try {
      p.onChange(await f());
    } finally {
      setBusy(false);
    }
  };
  if (p.person.relation === 'following')
    return (
      <a class="btn outline sm" href={`/u/${encodeURIComponent(p.person.username)}`} onClick={linkTo(`/u/${encodeURIComponent(p.person.username)}`)}>
        Following
      </a>
    );
  if (p.person.relation === 'requested')
    return (
      <button class="btn outline sm" disabled={busy} onClick={() => run(() => api.unfollow(p.person.username))} aria-label={`Requested — tap to cancel your request to @${p.person.username}`}>
        Requested
      </button>
    );
  if (p.person.relation === 'blocked') return <span class="small">Blocked</span>;
  return (
    <button class="btn primary sm" disabled={busy} onClick={() => run(() => api.follow(p.person.username))}>
      Follow
    </button>
  );
}

interface Menu {
  title: string;
  options: SheetOption[];
}
interface Confirm {
  title: string;
  message: string;
  label: string;
  run: () => Promise<unknown>;
}

export function People() {
  const { me, refresh } = useSession();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PersonCard[] | null>(null);
  const [segment, setSegment] = useState<Segment>(lastSegment);
  const [requests, setRequests] = useState<string[] | null>(null);
  const [followerList, setFollowers] = useState<PersonCard[] | null>(null);
  const [followingList, setFollowing] = useState<PersonCard[] | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [error, setError] = useState('');
  const latestQ = useRef('');

  const load = async () => {
    try {
      const [r, f, g] = await Promise.all([api.incomingRequests(), api.followers(), api.following()]);
      setRequests(r);
      setFollowers(f);
      setFollowing(g);
    } catch (e) {
      setError(errorText(e));
    }
  };
  useEffect(() => {
    load();
  }, []);

  // Search after a short pause; at least 2 characters.
  useEffect(() => {
    const query = q.trim();
    latestQ.current = query;
    if (query.length < 2) return setResults(null);
    const t = setTimeout(async () => {
      try {
        const people = await api.searchPeople(query);
        if (latestQ.current === query) setResults(people);
      } catch (e) {
        setError(errorText(e));
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const choose = (s: Segment) => {
    lastSegment = s;
    setSegment(s);
  };
  const act = async (f: () => Promise<unknown>) => {
    setMenu(null);
    setConfirm(null);
    setError('');
    try {
      await f();
      await Promise.all([load(), refresh()]);
    } catch (e) {
      setError(errorText(e));
    }
  };
  const ask = (c: Confirm) => {
    setMenu(null);
    setConfirm(c);
  };
  const blockOption = (username: string): SheetOption => ({
    label: 'Block',
    danger: true,
    onSelect: () =>
      ask({
        title: `Block @${username}?`,
        message: 'Follows between you are removed both ways, and they can’t find or request you. They aren’t told. You can undo this in More → Blocked people.',
        label: 'Block',
        run: () => api.block(username),
      }),
  });
  const view = (username: string): SheetOption => ({ label: 'View leaderboard', onSelect: () => navigate(`/u/${encodeURIComponent(username)}`) });

  const pending = me.pendingRequests ?? requests?.length ?? 0;
  return (
    <>
      <Header />
      <main class="screen">
        <div class="wrap" style={{ paddingTop: '12px' }}>
          <label class="search">
            <SearchIcon />
            <span class="visually-hidden">Search usernames</span>
            <input type="search" value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder="Search usernames" autoCapitalize="none" autoCorrect="off" spellcheck={false} enterKeyHint="search" />
          </label>
        </div>
        {error && (
          <p class="error wrap" role="alert">
            {error}
          </p>
        )}

        {results !== null ? (
          <div class="wrap stack">
            <div class="cap" style={{ padding: '8px 0 0' }}>
              {results.length ? 'Results' : `No one found for “${q.trim()}”`}
            </div>
            {results.length > 0 && (
              <div class="list">
                {results.map((r) => (
                  <PersonRow key={r.username} username={r.username}>
                    <RelationButton person={r} onChange={(next) => setResults((list) => list?.map((x) => (x.username === next.username ? next : x)) ?? null)} />
                  </PersonRow>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div class="wrap stack">
            <div class="seg" role="tablist" aria-label="People">
              {(
                [
                  ['requests', 'Requests', pending],
                  ['followers', 'Followers', followerList?.length],
                  ['following', 'Following', followingList?.length],
                ] as const
              ).map(([key, label, n]) => (
                <button key={key} role="tab" aria-selected={segment === key} class={segment === key ? 'on' : ''} onClick={() => choose(key)}>
                  {label}
                  {key === 'requests' ? n ? <span class="c">{n}</span> : null : n !== undefined && <span class="n num">{n}</span>}
                </button>
              ))}
            </div>

            {segment === 'requests' &&
              requests &&
              (requests.length ? (
                <div class="list">
                  {requests.map((u) => (
                    <PersonRow key={u} username={u}>
                      <button class="btn primary sm" onClick={() => act(() => api.approve(u))}>
                        Approve
                      </button>
                      <button class="btn secondary sm" onClick={() => act(() => api.decline(u))}>
                        Decline
                      </button>
                    </PersonRow>
                  ))}
                </div>
              ) : (
                <p class="lead empty-line">No follow requests. When someone asks to follow you, they’ll appear here.</p>
              ))}

            {segment === 'followers' &&
              followerList &&
              (followerList.length ? (
                <div class="list">
                  {followerList.map((f) => (
                    <PersonRow key={f.username} username={f.username}>
                      <button
                        class="more-btn"
                        aria-label={`Actions for @${f.username}`}
                        onClick={() =>
                          setMenu({
                            title: `@${f.username}`,
                            options: [
                              ...(f.relation === 'following' ? [view(f.username)] : []),
                              ...(f.relation === 'none' ? [{ label: 'Follow back', onSelect: () => act(() => api.follow(f.username)) }] : []),
                              {
                                label: 'Remove follower',
                                danger: true,
                                onSelect: () =>
                                  ask({ title: `Remove @${f.username}?`, message: 'They stop seeing your leaderboard straight away. They aren’t told.', label: 'Remove follower', run: () => api.removeFollower(f.username) }),
                              },
                              blockOption(f.username),
                            ],
                          })
                        }
                      >
                        <MoreIcon />
                      </button>
                    </PersonRow>
                  ))}
                </div>
              ) : (
                <p class="lead empty-line">No followers yet. People who follow you see your leaderboard, never your Log, prices or notes.</p>
              ))}

            {segment === 'following' &&
              followingList &&
              (followingList.length ? (
                <div class="list">
                  {followingList.map((f) => (
                    <PersonRow key={f.username} username={f.username} note={f.relation === 'requested' ? 'Requested' : undefined}>
                      <button
                        class="more-btn"
                        aria-label={`Actions for @${f.username}`}
                        onClick={() =>
                          setMenu({
                            title: `@${f.username}`,
                            options: [
                              ...(f.relation === 'following'
                                ? [
                                    view(f.username),
                                    {
                                      label: 'Unfollow',
                                      danger: true,
                                      onSelect: () => ask({ title: `Unfollow @${f.username}?`, message: 'You’ll need to request again to see their leaderboard.', label: 'Unfollow', run: () => api.unfollow(f.username) }),
                                    },
                                  ]
                                : [{ label: 'Cancel request', danger: true, onSelect: () => act(() => api.unfollow(f.username)) }]),
                              blockOption(f.username),
                            ],
                          })
                        }
                      >
                        <MoreIcon />
                      </button>
                    </PersonRow>
                  ))}
                </div>
              ) : (
                <p class="lead empty-line">You’re not following anyone yet. Search for a username above.</p>
              ))}
          </div>
        )}
      </main>
      <TabBar active="people" />
      {menu && <Sheet title={menu.title} options={menu.options} onCancel={() => setMenu(null)} />}
      {confirm && <Sheet title={confirm.title} message={confirm.message} options={[{ label: confirm.label, danger: true, onSelect: () => act(confirm.run) }]} onCancel={() => setConfirm(null)} />}
    </>
  );
}

/** More → Blocked people: the only place blocks are listed and undone. */
export function BlockedPeople() {
  const [list, setList] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const load = () =>
    api
      .blocked()
      .then(setList)
      .catch((e) => setError(errorText(e)));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <Header title="Blocked people" left={<BackButton to="/more" />} />
      <main class="screen">
        <div class="wrap stack" style={{ paddingTop: '16px' }}>
          <p class="lead">Blocked people can’t find you, request to follow you or see your leaderboard. They aren’t told.</p>
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          {list && list.length === 0 && <p class="lead empty-line">You haven’t blocked anyone.</p>}
          {list && list.length > 0 && (
            <div class="list">
              {list.map((u) => (
                <div class="prow" key={u}>
                  <span class="who">
                    <Avatar username={u} />
                    <span class="u">@{u}</span>
                  </span>
                  <span class="acts">
                    <button class="btn secondary sm" onClick={() => api.unblock(u).then(load).catch((e) => setError(errorText(e)))}>
                      Unblock
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <TabBar active="more" />
    </>
  );
}
