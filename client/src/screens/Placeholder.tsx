import { Header, TabBar, type Tab } from '../components/chrome';
import { LeafOutline } from '../icons';

const COPY: Record<Extract<Tab, 'log' | 'people'>, { title: string; body: string }> = {
  log: { title: 'The Log is on its way', body: 'Everything you’ve tried, grouped by country, arrives in a later update.' },
  people: { title: 'People is on its way', body: 'Following, requests and search arrive in a later update.' },
};

/** Stand-in for tabs built in later phases, so the shell and navigation can be tried now. */
export function Placeholder(p: { tab: 'log' | 'people' }) {
  const { title, body } = COPY[p.tab];
  return (
    <>
      <Header />
      <main class="screen">
        <div class="empty">
          <LeafOutline />
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
      </main>
      <TabBar active={p.tab} />
    </>
  );
}
