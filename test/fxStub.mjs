// A stand-in for the exchange-rate service (D66) for the test servers: Frankfurter's v2 rows
// (`[{ date, base, quote, rate }]`), per euro, working days only, made-up rates that change a
// little with the day of the month so each day's rate can be told apart:
//   GBP 0.85 + day/1000 (20 Oct → 0.87), USD 1.10 + day/1000, JPY 160 + day, any other 2 + day/1000.
// Any day in 2001 asked about makes it fail (503), to test the service being down; asked for the ECB's
// rates of rand (ZAR) only, it refuses the choice (422), to test asking again without it.
// GET /calls answers how many rate requests it has had.
import { createServer } from 'node:http';

const BASE = { GBP: 0.85, USD: 1.1, JPY: 160 };
export const stubRate = (code, day) => {
  const d = Number(day.slice(8, 10));
  return code === 'JPY' ? 160 + d : (BASE[code] ?? 2) + d / 1000;
};

export function startFxStub(port = 0) {
  let calls = 0;
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/calls') return res.end(JSON.stringify({ calls }));
    if (url.pathname !== '/v2/rates') return (res.statusCode = 404), res.end('{}');
    calls++;
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const quotes = (url.searchParams.get('quotes') ?? '').split(',').filter(Boolean);
    if (url.searchParams.get('base') !== 'EUR' || !from || !to || to.startsWith('2001') || from.startsWith('2001')) return (res.statusCode = 503), res.end('{}');
    if (url.searchParams.get('providers') === 'ecb' && quotes.includes('ZAR')) return (res.statusCode = 422), res.end('{"message":"unknown provider"}');
    const rows = [];
    for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
      const day = new Date(t).toISOString().slice(0, 10);
      const wd = new Date(t).getUTCDay();
      if (wd === 0 || wd === 6) continue;
      for (const q of quotes) if (q !== 'EUR') rows.push({ date: day, base: 'EUR', quote: q, rate: stubRate(q, day) });
    }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(rows));
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })));
}
