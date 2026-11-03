import { useEffect, useState } from 'preact/hooks';
import { ShareIcon } from '../icons';
import { invite, WEBSITE } from '../invite';
import { useSession } from '../session';

/** Invite a friend (D82): on the empty Feed and on People. */
export function InviteButton(p: { kind?: 'primary' | 'secondary' }) {
  const { me } = useSession();
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 3000);
    return () => clearTimeout(t);
  }, [note]);
  const username = me.user?.username;
  if (!username) return null;
  const tap = async () => {
    const r = await invite(username);
    if (r === 'copied') setNote('Invite copied: paste it in a message');
    else if (r === 'failed') setNote(`Couldn’t share. Send them ${WEBSITE} and your @${username}`);
  };
  return (
    <>
      <button type="button" class={`btn ${p.kind ?? 'primary'} invite-btn`} onClick={tap}>
        <ShareIcon />
        Invite a friend
      </button>
      {note && (
        <p class="toast" role="status">
          {note}
        </p>
      )}
    </>
  );
}
