import { useEffect, useState } from 'preact/hooks';
import { api, errorText, type Passkey } from '../api';
import { BackButton, Header, Sheet, TabBar } from '../components/chrome';
import { MeButton } from '../components/MeButton';
import { RecoveryCodesBlock } from '../components/RecoveryCodes';
import { ownProfilePhotoUrl } from '../../../shared/domain/photo';
import { Avatar } from '../components/Avatar';
import { BlockIcon, ChevronRight, DevicesIcon, DownloadIcon, KeyIcon, LeafGlass, LifeRingIcon, SignOutIcon, TrashIcon, UploadIcon, BoxIcon } from '../icons';
import * as people from '../people';
import { addPasskey } from '../passkey';
import { cachedProducts, fetchArchived, fetchProducts } from '../products';
import { linkTo } from '../router';
import { formatDate, useSession } from '../session';

declare const __APP_VERSION__: string;

type Tint = 'green' | 'amber' | 'teal' | 'red';
/** A settings row (D38, 0.31.0): a small tinted icon tile, the label, an optional value and an arrow. */
function Row(p: { label: string; value?: string; to?: string; onClick?: () => void; danger?: boolean; icon?: preact.ComponentType<{ class?: string }>; tint?: Tint }) {
  const Icon = p.icon;
  const inner = (
    <>
      {Icon && (
        <span class={`li-ic ${p.tint ?? 'green'}`}>
          <Icon />
        </span>
      )}
      <span class="main">{p.label}</span>
      {p.value && <span class="v">{p.value}</span>}
      {p.to && <ChevronRight class="chev" />}
    </>
  );
  const cls = `li${p.to || p.onClick ? ' link' : ''}${p.danger ? ' dng' : ''}`;
  if (p.to) {
    return (
      <a class={cls} href={p.to} onClick={linkTo(p.to)}>
        {inner}
      </a>
    );
  }
  if (p.onClick) {
    return (
      <button class={cls} onClick={p.onClick}>
        {inner}
      </button>
    );
  }
  return <div class={cls}>{inner}</div>;
}

/** "24 products · 3 followers · 4 following" — each part once its number has arrived. */
function summary(products: number | null, counts: { followers: number; following: number } | null): string {
  const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;
  const parts: string[] = [];
  if (products !== null) parts.push(n(products, 'product', 'products'));
  if (counts) parts.push(n(counts.followers, 'follower', 'followers'), `${counts.following} following`);
  return parts.join(' · ');
}

export function More() {
  const { me, refresh } = useSession();
  const [confirmEverywhere, setConfirmEverywhere] = useState(false);
  const [error, setError] = useState('');
  const [archived, setArchived] = useState<number | null>(null);
  const [products, setProducts] = useState<number | null>(() => cachedProducts()?.length ?? null);
  const [counts, setCounts] = useState<{ followers: number; following: number } | null>(null);

  useEffect(() => {
    fetchArchived()
      .then((list) => setArchived(list.length))
      .catch(() => {});
    fetchProducts()
      .then((list) => setProducts(list.length))
      .catch(() => {});
    Promise.all([people.followers(), people.following()])
      .then(([f, g]) => setCounts({ followers: f.length, following: g.length }))
      .catch(() => {});
  }, []);

  async function signOut(everywhere: boolean) {
    setConfirmEverywhere(false);
    try {
      await api('POST', everywhere ? '/account/signout-everywhere' : '/auth/signout');
      await refresh();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const passkeys = me.passkeys ?? 0;
  const codes = me.recoveryCodesLeft ?? 0;
  return (
    <>
      <Header right={<MeButton />} />
      <main class="screen">
        {/* D38 (0.31.0): you at the top, then the settings with icon tiles, like the iPhone's Settings. */}
        <div class="wrap more-top">
          <a class="more-me" href="/people" onClick={linkTo('/people')}>
            <Avatar username={me.user?.username ?? '?'} src={me.user?.photo ? ownProfilePhotoUrl(me.user.photo.version, 'thumb') : undefined} size="xl" />
            <span class="who">
              <b>@{me.user?.username}</b>
              <span>{summary(products, counts)}</span>
            </span>
            <ChevronRight class="chev" />
          </a>
        </div>
        <div class="lh cap">Account</div>
        <div class="wrap">
          <div class="list">
            <Row label="Passkeys" value={String(passkeys)} to="/more/passkeys" icon={KeyIcon} />
            <Row label="Recovery codes" value={`${codes} left`} to="/more/recovery-codes" icon={LifeRingIcon} tint="amber" />
            <Row label="Blocked people" to="/more/blocked" icon={BlockIcon} />
          </div>
        </div>
        <div class="lh cap">Data</div>
        <div class="wrap">
          <div class="list">
            <Row label="Export" to="/more/export" icon={UploadIcon} tint="teal" />
            <Row label="Restore" to="/more/restore" icon={DownloadIcon} tint="teal" />
            <Row label="Archive" value={archived === null ? undefined : String(archived)} to="/more/archive" icon={BoxIcon} />
          </div>
        </div>
        <div class="wrap more-gap">
          <div class="list">
            <Row label="Sign out" onClick={() => signOut(false)} icon={SignOutIcon} />
            <Row label="Sign out everywhere" onClick={() => setConfirmEverywhere(true)} icon={DevicesIcon} />
          </div>
          {error && (
            <p class="error" role="alert" style={{ marginTop: '8px' }}>
              {error}
            </p>
          )}
        </div>
        <div class="lh cap dng">Danger zone</div>
        <div class="wrap">
          <div class="list">
            <Row label="Delete account" to="/more/delete" danger icon={TrashIcon} tint="red" />
          </div>
        </div>
        <footer class="more-foot">
          <LeafGlass />
          <span>Green Tracker {__APP_VERSION__}</span>
        </footer>
      </main>
      <TabBar active="more" />
      {confirmEverywhere && (
        <Sheet
          title="Sign out everywhere?"
          message="You’ll be signed out on every device, including this one."
          options={[{ label: 'Sign out everywhere', danger: true, onSelect: () => signOut(true) }]}
          onCancel={() => setConfirmEverywhere(false)}
        />
      )}
    </>
  );
}

function when(p: Passkey): string {
  const added = `Added ${formatDate(p.createdAt)}`;
  return p.lastUsedAt && p.lastUsedAt !== p.createdAt ? `${added} · Last used ${formatDate(p.lastUsedAt)}` : added;
}

export function Passkeys() {
  const { refresh } = useSession();
  const [list, setList] = useState<Passkey[] | null>(null);
  const [removing, setRemoving] = useState<Passkey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ passkeys: Passkey[] }>('GET', '/account/passkeys')
      .then((r) => setList(r.passkeys))
      .catch((e) => setError(errorText(e)));
  }, []);

  async function add() {
    setBusy(true);
    setError('');
    try {
      setList((await addPasskey()).passkeys);
      await refresh();
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  }

  async function remove(p: Passkey) {
    setRemoving(null);
    setError('');
    try {
      setList((await api<{ passkeys: Passkey[] }>('DELETE', `/account/passkeys/${encodeURIComponent(p.id)}`)).passkeys);
      await refresh();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const only = list?.length === 1;
  return (
    <>
      <Header title="Passkeys" left={<BackButton to="/more" />} />
      <main class="screen">
        <div class="wrap stack" style={{ paddingTop: '16px' }}>
          <p class="lead">A passkey signs you in with Face ID, Touch ID or your screen lock. Add one on each device you use.</p>
          {list && (
            <div class="list">
              {list.map((p) => (
                <div class="li" key={p.id}>
                  <span class="main">
                    {p.name}
                    <span class="sub">{when(p)}</span>
                  </span>
                  {!only && (
                    <button class="act" onClick={() => setRemoving(p)} aria-label={`Remove passkey ${p.name}`}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {only && <p class="hint">You need at least one passkey, so your only one can’t be removed.</p>}
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          <button class="btn secondary" onClick={add} disabled={busy}>
            {busy ? 'Waiting for your passkey…' : 'Add a passkey on this device'}
          </button>
        </div>
      </main>
      <TabBar active="more" />
      {removing && (
        <Sheet
          title={`Remove “${removing.name}”?`}
          message="You won’t be able to sign in with this passkey any more."
          options={[{ label: 'Remove passkey', danger: true, onSelect: () => remove(removing) }]}
          onCancel={() => setRemoving(null)}
        />
      )}
    </>
  );
}

export function RecoveryCodes() {
  const { me, refresh } = useSession();
  const [confirm, setConfirm] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState('');

  async function regenerate() {
    setConfirm(false);
    setError('');
    try {
      setCodes((await api<{ recoveryCodes: string[] }>('POST', '/account/recovery-codes')).recoveryCodes);
      await refresh();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const left = me.recoveryCodesLeft ?? 0;
  return (
    <>
      <Header title="Recovery codes" left={<BackButton to="/more" />} />
      <main class="screen">
        <div class="wrap stack" style={{ paddingTop: '16px' }}>
          {codes ? (
            <>
              <p class="lead">
                Your new codes are below and your old ones no longer work. <strong>This is the only time you’ll see these.</strong>
              </p>
              <RecoveryCodesBlock username={me.user?.username ?? ''} codes={codes} />
            </>
          ) : (
            <>
              <p class="lead">
                You have <strong>{left} of 10</strong> codes left. Each one signs you in once if you lose your passkeys.
              </p>
              <p class="lead">Making new codes cancels all the old ones, including any you haven’t used.</p>
              {error && (
                <p class="error" role="alert">
                  {error}
                </p>
              )}
              <button class="btn secondary" onClick={() => setConfirm(true)}>
                Make new codes
              </button>
            </>
          )}
        </div>
      </main>
      <TabBar active="more" />
      {confirm && (
        <Sheet
          title="Make new recovery codes?"
          message="Your current codes will stop working straight away."
          options={[{ label: 'Make new codes', danger: true, onSelect: regenerate }]}
          onCancel={() => setConfirm(false)}
        />
      )}
    </>
  );
}
