import { useEffect, useRef, useState } from 'preact/hooks';
import { photoUrl } from '../../../shared/domain/photo';
import { scoreBand } from '../../../shared/domain/gems';
import { formatScore } from '../../../shared/domain/format';
import { postPhotoUrl, timeLabel, type Post, type PostAbout } from '../../../shared/domain/posts';
import { productType, STRAIN_TYPES } from '../../../shared/domain/productTypes';
import { countryDisplay } from '../../../shared/domain/countries';
import { errorText } from '../api';
import { CommentIcon, FireIcon, FireLineIcon, MoreIcon, TypeMark } from '../icons';
import * as posts from '../posts';
import { linkTo } from '../router';
import { photoOf } from '../screens/People';
import { heatStyle } from '../heat';
import { play } from '../sounds';
import { Avatar } from './Avatar';
import { YourChip } from './Duel';
import { Sheet } from './chrome';
import { Effects, rowClass, useAppearance } from './Gems';

// A post (D77): who and when, its own photo, the card for what it's about, the fire and comment
// counts, the caption and (in a list) the first two comments. The same card in the Feed, on a
// person's Posts and on the post's own page.

const enc = encodeURIComponent;
const typeName = (a: Pick<PostAbout, 'productType' | 'productTypeOther'>): string | null => {
  if (!a.productType || a.productType === 'not_set') return null;
  const def = productType(a.productType);
  return def.freeText ? a.productTypeOther?.trim() || def.label : def.label;
};

/** The card under the photo: a product in the poster's colours (D48), a Log entry, or a plain one that doesn't open. */
export function AboutCard(p: { about: PostAbout }) {
  const own = useAppearance();
  const a = p.about;
  const def = a.productType ? productType(a.productType) : null;
  const strain = STRAIN_TYPES.find((s) => s.key === a.strainType);
  const country = countryDisplay(a.country, a.countryOther);
  const band = a.kind === 'product' ? scoreBand('overall', a.score) : null;
  const appearance = { ...own, preset: a.preset ?? own.preset, markFirst: false };
  const type = typeName(a);
  const body = (
    <>
      {a.kind === 'product' && <Effects band={band} appearance={appearance} />}
      {/* D78: the product's cover, as on their board; otherwise the type's icon. */}
      <span class={`thumb${a.photo?.cutout ? ' cut' : ''}`}>
        {a.photo ? <img src={photoUrl(a.photo, 'thumb')} alt="" loading="lazy" decoding="async" /> : def?.icon && <TypeMark icon={def.icon} label={def.label} />}
      </span>
      <div class="mid">
        <div class="name">{a.name}</div>
        <div class="cluster">
          {strain && <span class={`tag ${strain.key}`}>{strain.label}</span>}
          {country?.flag && (
            <span class="flag" role="img" aria-label={country.name}>
              {country.flag}
            </span>
          )}
          {type && <span class="ptype">{type}</span>}
        </div>
        {a.source && (
          <div class="meta">
            <span class="src">{a.source}</span>
          </div>
        )}
      </div>
      {a.kind === 'product' &&
        (a.score === null ? (
          <div class="score unrated">
            <b>–</b>
            <span class="cap">Unrated</span>
            {a.yours && <YourChip score={a.yours.score} />}
          </div>
        ) : (
          <div class="score">
            <b>{formatScore(a.score)}</b>
            <span class="cap">Overall</span>
            {/* D82: you've had the same product: your photo and your score, only for you. */}
            {a.yours && <YourChip score={a.yours.score} />}
          </div>
        ))}
      {a.kind === 'log' && <span class="in-log">In the Log</span>}
    </>
  );
  const cls = `row about ${a.kind}${a.kind === 'product' ? rowClass({ band, first: false }, appearance) : ''}`;
  const heat = a.kind === 'product' ? heatStyle(band, 'overall', a.score) : {};
  return a.href ? (
    <a class={cls} {...heat} href={a.href} onClick={linkTo(a.href)}>
      {body}
    </a>
  ) : (
    <div class={cls} {...heat}>
      {body}
    </div>
  );
}

/**
 * D78: a post's photos, swiped sideways one at a time (snapping), with "2/3" in the corner and dots underneath. Every
 * photo takes the first one's shape (between 4:5 and 1.91:1, as Instagram), so the post doesn't change height as you
 * swipe; a cut-out is shown whole on its glow.
 */
function PostPhotos(p: { post: Post; href?: string; eager?: boolean }) {
  const post = p.post;
  const photos = post.photos?.length ? post.photos : [post.image];
  const [at, setAt] = useState(0);
  const [ratio, setRatio] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const n = photos.length;
  const alt = (i: number) => (post.about ? `Photo ${n > 1 ? `${i + 1} of ${n} ` : ''}of ${post.about.name}` : `Photo ${n > 1 ? `${i + 1} of ${n} ` : ''}by @${post.username}`);
  const onScroll = () => {
    const t = track.current;
    if (t) setAt(Math.max(0, Math.min(n - 1, Math.round(t.scrollLeft / Math.max(1, t.clientWidth)))));
  };
  const style = ratio ? { '--ratio': String(Math.min(1.91, Math.max(0.8, ratio))) } : undefined;
  // In a list each photo opens the post (so the strip, which scrolls, holds links you can reach by keyboard);
  // on the post's own page the strip itself takes focus, to scroll with the arrow keys.
  const cls = `post-photo${post.image.cutout ? ' cut' : ''}${n > 1 ? ' many' : ''}`;
  const img = (ph: { version: string; cutout: boolean }, i: number) => (
    <img
      class={ph.cutout ? 'cut' : undefined}
      src={postPhotoUrl(post, 'cropped', i)}
      alt={alt(i)}
      loading={i === 0 && p.eager ? undefined : 'lazy'}
      decoding="async"
      draggable={false}
      onLoad={i === 0 ? (e) => setRatio(e.currentTarget.naturalWidth / Math.max(1, e.currentTarget.naturalHeight)) : undefined}
    />
  );
  return (
    <>
      <div class={cls} style={style}>
        <div class="track" ref={track} onScroll={onScroll} {...(!p.href && n > 1 ? { tabIndex: 0, role: 'group', 'aria-label': `${n} photos: swipe for more` } : {})}>
          {photos.map((ph, i) =>
            p.href ? (
              <a key={ph.version} class="slide" href={p.href} onClick={linkTo(p.href)} aria-label={n > 1 ? `Open the post (photo ${i + 1} of ${n})` : 'Open the post'}>
                {img(ph, i)}
              </a>
            ) : (
              <div key={ph.version} class="slide">
                {img(ph, i)}
              </div>
            ),
          )}
        </div>
        {n > 1 && <span class="photo-count">{`${at + 1}/${n}`}</span>}
      </div>
      {n > 1 && (
        <div class="photo-dots" aria-hidden="true">
          {photos.map((ph, i) => (
            <span key={ph.version} class={i === at ? 'on' : undefined} />
          ))}
        </div>
      )}
    </>
  );
}

/** Who gave a fire, from tapping the count. */
function FirersSheet(p: { post: Post; onClose: () => void }) {
  const [people, setPeople] = useState<{ username: string; photo?: string }[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    posts
      .firers(p.post.id)
      .then(setPeople)
      .catch((e) => setError(errorText(e)));
  }, [p.post.id]);
  return (
    <>
      <div class="scrim" onClick={p.onClose} />
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Who gave a fire">
        <div class="grp">
          <div class="ttl">
            <strong>
              {p.post.fires} {p.post.fires === 1 ? 'fire' : 'fires'}
            </strong>
          </div>
          <div class="firers">
            {error && <p class="error">{error}</p>}
            {!people && !error && <p class="small">Loading…</p>}
            {people?.map((f) => (
              <a key={f.username} class="who" href={`/u/${enc(f.username)}`} onClick={linkTo(`/u/${enc(f.username)}`)}>
                <Avatar username={f.username} src={photoOf(f)} />
                <span class="u">@{f.username}</span>
              </a>
            ))}
          </div>
        </div>
        <div class="grp">
          <button type="button" class="opt bold" onClick={p.onClose} autoFocus>
            Done
          </button>
        </div>
      </div>
    </>
  );
}

/** Edit caption: a sheet with the text, Save and Cancel. */
export function CaptionSheet(p: { post: Post; onSaved: (post: Post) => void; onClose: () => void }) {
  const [text, setText] = useState(p.post.caption);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const left = 500 - [...text].length;
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      p.onSaved(await posts.editCaption(p.post.id, text));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <>
      <div class="scrim" onClick={p.onClose} />
      <div class="sheet caption-sheet" role="dialog" aria-modal="true" aria-label="Edit caption">
        <div class="grp pad">
          <label for="caption-edit" class="lbl">
            Edit caption
          </label>
          <textarea id="caption-edit" class="caption-input" maxLength={500} value={text} onInput={(e) => setText(e.currentTarget.value)} autoFocus />
          {left <= 50 && <div class={`count${left < 0 ? ' over' : ''}`}>{left} left</div>}
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          <div class="btn-row">
            <button type="button" class="btn secondary" onClick={p.onClose}>
              Cancel
            </button>
            <button type="button" class="btn primary" disabled={busy || left < 0} onClick={save}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * A post. `full`: on its own page (the whole caption, no comments here: the page lists them).
 * `eager`: the first post in a list, whose first photo loads at once; every other photo waits until it's
 * about to scroll into view (0.69.9: the Feed fetched every post's photo straight away).
 * `onChange` gets the post back after a fire or an edit; `onDeleted` after Delete post.
 */
export function PostCard(p: { post: Post; full?: boolean; eager?: boolean; onChange: (post: Post) => void; onDeleted: () => void }) {
  const post = p.post;
  const [busy, setBusy] = useState(false);
  const [popped, setPopped] = useState(false);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<'menu' | 'confirm' | 'caption' | 'fires' | null>(null);
  const [error, setError] = useState('');
  const href = `/posts/${enc(post.id)}`;
  const who = `/u/${enc(post.username)}`;
  const long = !p.full && !open && (post.caption.length > 140 || post.caption.split('\n').length > 3);

  const fire = async () => {
    if (busy) return;
    const on = !post.youFired;
    setBusy(true);
    setPopped(on);
    p.onChange({ ...post, youFired: on, fires: post.fires + (on ? 1 : -1) }); // at once; the server's count follows
    try {
      const r = await posts.setFire(post.id, on);
      p.onChange({ ...post, ...r });
    } catch (e) {
      p.onChange(post);
      setError(errorText(e));
    }
    setBusy(false);
  };
  const remove = async () => {
    setSheet(null);
    try {
      await posts.deletePost(post.id);
      play('delete');
      p.onDeleted();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <article class="post" aria-label={`Post by @${post.username}`} data-post={post.id}>
      <div class="post-who">
        <a class="who" href={who} onClick={linkTo(who)}>
          <Avatar username={post.username} src={photoOf(post)} />
          <span class="u">
            @{post.username}
            <time class="small" dateTime={new Date(post.createdAt).toISOString()}>
              {timeLabel(post.createdAt)}
              {post.editedAt ? ' · edited' : ''}
            </time>
          </span>
        </a>
        {post.mine && (
          <button type="button" class="more-btn" aria-label="Your post’s actions" onClick={() => setSheet('menu')}>
            <MoreIcon />
          </button>
        )}
      </div>
      <PostPhotos post={post} href={p.full ? undefined : href} eager={p.full || p.eager} />
      {post.about && <AboutCard about={post.about} />}
      <div class="post-acts">
        <button type="button" class={`act fire${post.youFired ? ' on' : ''}${popped ? ' pop' : ''}`} aria-pressed={post.youFired} aria-label="Give a fire" onClick={fire} onAnimationEnd={() => setPopped(false)}>
          {post.youFired ? <FireIcon /> : <FireLineIcon />}
        </button>
        <button type="button" class="act count" disabled={post.fires === 0} onClick={() => setSheet('fires')} aria-label={`${post.fires} ${post.fires === 1 ? 'fire' : 'fires'}: see who`}>
          {post.fires}
        </button>
        {p.full ? (
          <span class="act">
            <CommentIcon />
            <span class="num">{post.commentCount}</span>
            <span class="visually-hidden">{post.commentCount === 1 ? 'comment' : 'comments'}</span>
          </span>
        ) : (
          <a class="act" href={href} onClick={linkTo(href)} aria-label={`${post.commentCount} ${post.commentCount === 1 ? 'comment' : 'comments'}`}>
            <CommentIcon />
            <span class="num">{post.commentCount}</span>
          </a>
        )}
      </div>
      {post.caption && <p class={`post-caption${long ? ' clamp' : ''}`}>{post.caption}</p>}
      {long && (
        <button type="button" class="link-btn more-text" onClick={() => setOpen(true)}>
          more
        </button>
      )}
      {!p.full && post.comments.length > 0 && (
        <div class="post-cmts">
          {post.comments.map((c) => (
            <p key={c.id}>
              <b>@{c.username}</b> {c.body}
            </p>
          ))}
          {post.commentCount > post.comments.length && (
            <a class="all" href={href} onClick={linkTo(href)}>
              View all {post.commentCount} comments
            </a>
          )}
        </div>
      )}
      {error && (
        <p class="error post-error" role="alert">
          {error}
        </p>
      )}
      {sheet === 'menu' && (
        <Sheet
          options={[
            { label: 'Edit caption', onSelect: () => setSheet('caption') },
            { label: 'Delete post', danger: true, onSelect: () => setSheet('confirm') },
          ]}
          onCancel={() => setSheet(null)}
        />
      )}
      {sheet === 'confirm' && (
        <Sheet title="Delete this post?" message="It goes for everyone, with its comments and fires." options={[{ label: 'Delete post', danger: true, tick: true, onSelect: remove }]} onCancel={() => setSheet(null)} />
      )}
      {sheet === 'caption' && (
        <CaptionSheet
          post={post}
          onClose={() => setSheet(null)}
          onSaved={(next) => {
            setSheet(null);
            p.onChange(next);
          }}
        />
      )}
      {sheet === 'fires' && <FirersSheet post={post} onClose={() => setSheet(null)} />}
    </article>
  );
}
