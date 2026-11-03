import { useEffect, useRef, useState } from 'preact/hooks';
import { COMMENT_MAX, timeLabel, type Post, type PostComment } from '../../../shared/domain/posts';
import { ApiError, errorText } from '../api';
import { Avatar } from '../components/Avatar';
import { BackButton, Header, Sheet, TabBar } from '../components/chrome';
import { PostCard } from '../components/PostCard';
import { Skeleton } from '../components/Skeleton';
import { MoreIcon } from '../icons';
import * as posts from '../posts';
import { back, linkTo } from '../router';
import { photoOf } from './People';

// A post's own page (D77): the post in full, every comment oldest first, and a comment box above
// the keyboard. In your own look. Anything you can't see (deleted, unfollowed, blocked, made up) is
// the same "This post isn't available".

const enc = encodeURIComponent;

function Comment(p: { c: PostComment; onMenu: () => void }) {
  const who = `/u/${enc(p.c.username)}`;
  return (
    <div class="cmt">
      <a class="cmt-av" href={who} onClick={linkTo(who)} aria-label={`@${p.c.username}`}>
        <Avatar username={p.c.username} src={photoOf(p.c)} />
      </a>
      <div class="cmt-body">
        <a class="u" href={who} onClick={linkTo(who)}>
          @{p.c.username}
        </a>
        <time class="small" dateTime={new Date(p.c.createdAt).toISOString()}>
          {timeLabel(p.c.createdAt)}
        </time>
        <p>{p.c.body}</p>
      </div>
      {p.c.canDelete && (
        <button type="button" class="more-btn" aria-label={`Actions for @${p.c.username}’s comment`} onClick={p.onMenu}>
          <MoreIcon />
        </button>
      )}
    </div>
  );
}

export function PostPage(p: { id: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState<PostComment | null>(null);

  const show = (next: Post) => {
    setPost(next);
    posts.patchKept(next);
  };

  useEffect(() => {
    posts
      .fetchPost(p.id)
      .then(show)
      .catch((e) => setGone(e instanceof ApiError && e.status === 404 ? 'This post isn’t available' : errorText(e)));
  }, [p.id]);

  const send = async (e: Event) => {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      show(await posts.addComment(p.id, draft));
      setDraft('');
      requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight));
    } catch (err) {
      setError(errorText(err));
    }
    setSending(false);
  };
  const removeComment = async (c: PostComment) => {
    setMenu(null);
    try {
      show(await posts.deleteComment(p.id, c.id));
    } catch (err) {
      setError(errorText(err));
    }
  };

  const left = COMMENT_MAX - [...draft].length;
  // The comments leave room for the comment box, however tall it is (the line under it can wrap, an error
  // adds one): its height goes in --cbox-h for .post-page .cmts (0.69.9).
  const box = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const el = box.current;
    const main = el?.parentElement?.querySelector<HTMLElement>('.post-page');
    if (!el || !main || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => main.style.setProperty('--cbox-h', `${Math.ceil(el.getBoundingClientRect().height)}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, [!!post]);
  return (
    <>
      <Header title="Post" leaf={false} left={<BackButton to="/feed" />} />
      <main class="screen post-page">
        {gone && (
          <div class="empty">
            <h2>{gone === 'This post isn’t available' ? gone : 'Couldn’t load this post'}</h2>
            {gone !== 'This post isn’t available' && <p>{gone}</p>}
          </div>
        )}
        {!post && !gone && <Skeleton kind="posts" />}
        {post && (
          <>
            <PostCard
              post={post}
              full
              onChange={show}
              onDeleted={() => {
                posts.dropKept(post.id);
                back('/feed');
              }}
            />
            <section class="cmts" aria-label="Comments">
              <h2 class="cap">Comments</h2>
              {post.comments.length === 0 && <p class="small none">No comments yet.</p>}
              {post.comments.map((c) => (
                <Comment key={c.id} c={c} onMenu={() => setMenu(c)} />
              ))}
            </section>
          </>
        )}
      </main>
      {post && (
        <form ref={box} class="comment-box" onSubmit={send} aria-label="Add a comment">
          <label for="comment-input" class="visually-hidden">
            Add a comment
          </label>
          <input id="comment-input" type="text" enterKeyHint="send" maxLength={COMMENT_MAX} placeholder="Add a comment…" value={draft} onInput={(e) => setDraft(e.currentTarget.value)} />
          <button type="submit" class="btn primary send" disabled={!draft.trim() || sending}>
            Send
          </button>
          {left <= 30 && <span class={`count${left < 0 ? ' over' : ''}`}>{left}</span>}
          {/* Who sees it: everyone who can see the post (its owner's approved followers, D77). */}
          <p class="who-sees" id="comment-who">
            {post.mine ? 'Your followers see your comment and your @name.' : `Everyone who follows @${post.username} sees your comment and your @name.`}
          </p>
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
      {menu && (
        <Sheet
          title={menu.username === post?.username && post?.mine ? 'Your comment' : `@${menu.username}’s comment`}
          options={[{ label: 'Delete comment', danger: true, onSelect: () => removeComment(menu) }]}
          onCancel={() => setMenu(null)}
        />
      )}
      <TabBar active="feed" />
    </>
  );
}
