// Verifies host kick: host removes a player, the kicked player is notified,
// non-hosts can't kick, and the host can't kick themselves.
// Run against `wrangler dev`:  TT_URL=http://127.0.0.1:8787 node scripts/testKick.js
const BASE = process.env.TT_URL || 'http://127.0.0.1:8787';
const WS_BASE = BASE.replace(/^http/, 'ws');

const results = [];
const assert = (name, cond, extra = '') => { results.push(!!cond); console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(pred, timeout = 6000, label = '') {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (pred()) return true; await wait(40); }
  throw new Error('timeout: ' + label);
}
function conn(name, code) {
  const c = { name, state: null, playerId: null, kicked: false, ws: new WebSocket(`${WS_BASE}/api/room/${code}/ws`), open: false };
  c.ws.addEventListener('open', () => (c.open = true));
  c.ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === 'joined') c.playerId = m.playerId;
    else if (m.type === 'state') c.state = m.state;
    else if (m.type === 'kicked') c.kicked = true;
  });
  c.send = (o) => c.ws.send(JSON.stringify(o));
  return c;
}
const names = (s) => s.players.map((p) => p.name).sort().join(',');

async function main() {
  const { code } = await (await fetch(`${BASE}/api/new`)).json();
  const host = conn('Claude', code);
  await waitFor(() => host.open, 4000, 'host open');
  host.send({ type: 'createRoom', name: 'Claude' });
  await waitFor(() => host.state, 4000, 'host state');

  const bob = conn('Bob', code), carol = conn('Carol', code);
  await waitFor(() => bob.open && carol.open, 4000, 'others open');
  bob.send({ type: 'joinRoom', name: 'Bob' });
  carol.send({ type: 'joinRoom', name: 'Carol' });
  await waitFor(() => host.state.players.length === 3 && bob.playerId && carol.playerId, 4000, '3 players');

  // Non-host cannot kick.
  carol.send({ type: 'kickPlayer', playerId: bob.playerId });
  await wait(400);
  assert('non-host kick is ignored', host.state.players.length === 3, names(host.state));

  // Host cannot kick self.
  host.send({ type: 'kickPlayer', playerId: host.playerId });
  await wait(400);
  assert('host cannot kick self', host.state.players.length === 3 && host.state.players.some((p) => p.name === 'Claude'));

  // Host kicks Bob.
  host.send({ type: 'kickPlayer', playerId: bob.playerId });
  await waitFor(() => host.state.players.length === 2, 4000, 'bob kicked');
  assert('host kicked Bob (removed from room)', names(host.state) === 'Carol,Claude');
  await waitFor(() => bob.kicked, 3000, 'bob notified');
  assert('kicked player is notified', bob.kicked === true);

  [host, bob, carol].forEach((c) => { try { c.ws.close(); } catch {} });
  const failed = results.filter((r) => !r).length;
  console.log(`\n${failed === 0 ? '🎉 ALL PASSED' : '⚠️  ' + failed + ' FAILED'} (${results.length} checks)`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error('TEST ERROR:', e.message); process.exit(2); });
