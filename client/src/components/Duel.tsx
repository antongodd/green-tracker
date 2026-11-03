import type { ComponentChildren } from 'preact';
import { formatScore } from '../../../shared/domain/format';
import { personPhotoUrl } from '../../../shared/domain/photo';
import { useSession } from '../session';
import { Avatar } from './Avatar';
import { useOwnThumb } from './MeButton';

// You against them (D82). Anton's pick (option C): each person's profile photo and @name with their
// score, never "you · them". A hidden photo (D23, D45) is their letter, as everywhere else.

export interface Who {
  username: string;
  /** Their profile photo's address, where you may see it. */
  src?: string;
}

/** Them, from a person card (its photo only where the photo rule allows). */
export const them = (p: { username: string; photo?: string }): Who => ({ username: p.username, src: p.photo ? personPhotoUrl(p.username, p.photo, 'thumb') : undefined });

/** You, as the session knows you, with your own photo as the header has it. */
export function useMe(): Who {
  const { me } = useSession();
  return { username: me.user?.username ?? '', src: useOwnThumb(me.user?.photo?.version) };
}

const score = (n: number | null | undefined) => (n === null || n === undefined ? '–' : formatScore(n));

/** One person's column: photo, @name, then the value (a score unless `children` says otherwise). */
function Side(p: { who: Who; value?: number | null; mine?: boolean; children?: ComponentChildren }) {
  return (
    <div class={`duel-side${p.mine ? ' mine' : ''}`}>
      <Avatar username={p.who.username} src={p.who.src} size="md" />
      <span class="duel-name">@{p.who.username}</span>
      {p.children ?? <b class="duel-score">{score(p.value)}</b>}
    </div>
  );
}

/** Two columns: you on the left, them on the right. */
export function Duel(p: { me: Who; them: Who; mine?: number | null; theirs?: number | null; children?: [ComponentChildren, ComponentChildren] }) {
  return (
    <div class="duel">
      <Side who={p.me} value={p.mine} mine>
        {p.children?.[0]}
      </Side>
      <Side who={p.them} value={p.theirs}>
        {p.children?.[1]}
      </Side>
    </div>
  );
}

/** The small one in a post's product card: your photo and your score (the name would not fit). */
export function YourChip(p: { score: number | null }) {
  const me = useMe();
  return (
    <span class="your-chip">
      <Avatar username={me.username} src={me.src} size="xs" />
      <b>{score(p.score)}</b>
      <span class="visually-hidden">: you've had this too, @{me.username}'s score</span>
    </span>
  );
}
