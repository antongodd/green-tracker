import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Post } from '../../../shared/domain/posts';
import { errorText } from '../api';
import { Header, TabBar } from '../components/chrome';
import { EmptyCard } from '../components/EmptyCard';
import { MeButton } from '../components/MeButton';
import { PostCard } from '../components/PostCard';
import { Skeleton } from '../components/Skeleton';
import { PeopleIcon, PlusIcon } from '../icons';
import * as posts from '../posts';
import { cameFrom, linkTo, navigate } from '../router';
import { rememberRow, restoreRow } from '../scrollReturn';
import { useSession } from '../session';

// The Feed (D77): your posts and those of everyone you follow, newest first, 20 at a time as you
// scroll. In People's place in the tab bar; People is the button at the top left, with the follow
// requests number. Opening it marks it seen (the dot on the tab goes). Coming back from a post
// lands where you were.

/**
 * The post nearest the top of the screen and where it is, so a reload that adds posts above it can keep it
 * where it was (Safari doesn't keep it there by itself).
 */
function topPost(): { id: string; top: number } | null {
  const header = document.querySelector('.hdr')?.getBoundingClientRect().bottom ?? 0;
  for (const el of document.querySelectorAll<HTMLElement>('.posts [data-post]')) {
    const r = el.getBoundingClientRect();
    if (r.bottom > header) return { id: el.dataset.post!, top: r.top };
  }
  return null;
}

/**
 * Puts the first page on top of the posts already loaded: new posts come in above, the ones it holds are
 * updated (or gone), and older pages stay. If none of it overlaps, it is the list from here on.
 */
export function mergeFirstPage(cur: posts.Page | null, first: posts.Page): posts.Page {
  if (!cur) return first;
  const ids = new Set(first.posts.map((x) => x.id));
  const overlap = cur.posts.some((x) => ids.has(x.id));
  if (!overlap || !first.next) return first;
  // Older posts after the first page's last one stay (newest first, so they follow it in the list).
  const last = cur.posts.findIndex((x) => x.id === first.posts[first.posts.length - 1]?.id);
  const rest = last === -1 ? [] : cur.posts.slice(last + 1).filter((x) => !ids.has(x.id));
  return { posts: [...first.posts, ...rest], next: rest.length ? cur.next : first.next };
}

/** Keeps a list of posts: loads pages, updates one in place, drops a deleted one. */
export function usePostList(load: (before: string | null) => Promise<posts.Page>, opts: { keep?: boolean; key: string }) {
  const kept = opts.keep && /^\/posts\//.test(cameFrom() ?? '') ? posts.keptFeed() : null;
  const [page, setPage] = useState<posts.Page | null>(kept);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const latest = useRef(page);
  latest.current = page;
  const set = (p: posts.Page | null) => {
    setPage(p);
    if (opts.keep) posts.keepFeed(p);
  };

  useEffect(() => {
    if (kept) return;
    load(null)
      .then(set)
      .catch((e) => setError(errorText(e)));
  }, [opts.key]);

  // Reload the first page (the Feed tab tapped again, the app back on screen): 0.69.9.
  const reloading = useRef(false);
  const anchor = useRef<{ id: string; top: number } | null>(null);
  const reload = async (opts: { keepPlace?: boolean } = {}) => {
    if (reloading.current || !latest.current) return;
    reloading.current = true;
    try {
      const first = await load(null);
      anchor.current = opts.keepPlace && window.scrollY > 0 ? topPost() : null;
      set(mergeFirstPage(latest.current, first));
      setError('');
    } catch {
      // Keep what's on screen; the next reload tries again.
    }
    reloading.current = false;
  };
  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    anchor.current = null;
    const el = document.querySelector<HTMLElement>(`.posts [data-post="${CSS.escape(a.id)}"]`);
    if (el) window.scrollBy(0, el.getBoundingClientRect().top - a.top);
  }, [page]);

  const more = async () => {
    const cur = latest.current;
    if (!cur?.next || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await load(cur.next);
      const seen = new Set(cur.posts.map((x) => x.id));
      set({ posts: [...cur.posts, ...next.posts.filter((x) => !seen.has(x.id))], next: next.next });
    } catch (e) {
      setError(errorText(e));
    }
    setLoadingMore(false);
  };
  const change = (post: Post) => {
    const cur = latest.current;
    if (cur) set({ ...cur, posts: cur.posts.map((x) => (x.id === post.id ? post : x)) });
  };
  const drop = (id: string) => {
    const cur = latest.current;
    if (cur) set({ ...cur, posts: cur.posts.filter((x) => x.id !== id) });
  };
  return { page, error, more, reload, change, drop, loadingMore, restored: !!kept };
}

/** The list itself, with the next page loading as its end comes into view. */
export function PostList(p: { list: ReturnType<typeof usePostList>; returnKey: string }) {
  const { page, more, change, drop, loadingMore } = p.list;
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!end.current || !page?.next) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && more(), { rootMargin: '600px 0px' });
    io.observe(end.current);
    return () => io.disconnect();
  }, [page?.next, page?.posts.length]);
  if (!page) return null;
  // Opening a post remembers which one, so Back lands on it.
  const remember = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a[href^="/posts/"]');
    const art = a?.closest<HTMLElement>('[data-post]');
    if (art) rememberRow(p.returnKey, art.dataset.post!, art);
  };
  return (
    <div class="posts" onClickCapture={remember}>
      {page.posts.map((post, i) => (
        <div key={post.id} data-return={`${p.returnKey}:${post.id}`}>
          <PostCard post={post} eager={i === 0} onChange={change} onDeleted={() => drop(post.id)} />
        </div>
      ))}
      <div ref={end} class="posts-end" aria-hidden={!loadingMore}>
        {loadingMore && <Skeleton kind="posts" />}
      </div>
    </div>
  );
}

export function Feed() {
  const { me, refresh } = useSession();
  const list = usePostList(posts.feedPage, { keep: true, key: 'feed' });
  const requests = me.pendingRequests ?? 0;

  // The first page marks the Feed seen: the dot goes.
  useEffect(() => {
    if (list.page && !list.restored && me.feedNew) refresh();
  }, [!!list.page]);

  // Tapping the Feed tab while on the Feed goes back to the top and fetches what's new; so does coming
  // back to the app, keeping your place (0.69.9: iOS keeps a Home Screen app open for days).
  const feedNew = useRef(me.feedNew);
  feedNew.current = me.feedNew;
  useEffect(() => {
    const fresh = async (opts: { keepPlace?: boolean }) => {
      await list.reload(opts);
      if (feedNew.current) refresh();
    };
    const again = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== 'feed') return;
      if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      fresh({});
    };
    const back = () => document.visibilityState === 'visible' && fresh({ keepPlace: true });
    window.addEventListener('gt-tab-again', again);
    document.addEventListener('visibilitychange', back);
    return () => {
      window.removeEventListener('gt-tab-again', again);
      document.removeEventListener('visibilitychange', back);
    };
  }, []);

  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current || !list.page) return;
    restored.current = true;
    restoreRow('feed', list.restored);
  }, [list.page]);

  const people = (
    <a class="hbtn people-btn" href="/people" onClick={linkTo('/people')} aria-label={requests ? `People, ${requests} follow ${requests === 1 ? 'request' : 'requests'}` : 'People'}>
      <PeopleIcon />
      {requests > 0 && (
        <span class="badge" aria-hidden="true">
          {requests}
        </span>
      )}
    </a>
  );

  return (
    <>
      <Header title="Feed" leaf={false} left={people} right={<MeButton />} />
      <main class="screen has-fab feed">
        {list.error && !list.page && (
          <div class="empty">
            <h2>Couldn’t load the Feed</h2>
            <p>{list.error}</p>
          </div>
        )}
        {!list.page && !list.error && <Skeleton kind="posts" />}
        {list.page && list.page.posts.length === 0 && (
          <EmptyCard art="feed" title="Nothing here yet">
            <p>Posts by you and the people you follow show here. Only your approved followers ever see yours.</p>
            <div class="stack-btns">
              <button class="btn primary" onClick={() => navigate('/feed/new')}>
                Post something
              </button>
              <button class="btn secondary" onClick={() => navigate('/people')}>
                Find people
              </button>
            </div>
          </EmptyCard>
        )}
        {list.page && list.page.posts.length > 0 && <PostList list={list} returnKey="feed" />}
        {list.error && list.page && (
          <p class="error wrap" role="alert">
            {list.error}
          </p>
        )}
      </main>
      <button class="fab" aria-label="New post" onClick={() => navigate('/feed/new')}>
        <PlusIcon />
      </button>
      <TabBar active="feed" />
    </>
  );
}
