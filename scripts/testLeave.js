// Verifies leaving a room: player removal, host reassignment, room cleanup,
// and that a freed code can host a brand-new game.
// Run against `wrangler dev`:  TT_URL=http://127.0.0.1:8787 node scripts/testLeave.js
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
  const c = { name, state: null, playerId: null, ws: new WebSocket(`${WS_BASE}/api/room/${code}/ws`), open: false };
  c.ws.addEventListener('open', () => (c.open = true));
  c.ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.type === 'joined') c.playerId = m.playerId; else if (m.type === 'state') c.state = m.state; });
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

  const bob = conn('Bob', code); const carol = conn('Carol', code);
  await waitFor(() => bob.open && carol.open, 4000, 'players open');
  bob.send({ type: 'joinRoom', name: 'Bob' });
  carol.send({ type: 'joinRoom', name: 'Carol' });
  await waitFor(() => host.state.players.length === 3, 4000, '3 players');
  assert('3 players joined', names(host.state) === 'Bob,Carol,Claude');
  assert('Claude is host', host.state.players.find((p) => p.name === 'Claude').isHost);

  // Bob leaves
  bob.send({ type: 'leaveRoom' });
  await waitFor(() => host.state.players.length === 2, 4000, 'bob removed');
  assert('Bob removed after leave', names(host.state) === 'Carol,Claude');

  // Host (Claude) leaves -> Carol should be promoted
  host.send({ type: 'leaveRoom' });
  await waitFor(() => carol.state && carol.state.players.length === 1, 4000, 'host removed');
  assert('only Carol remains', names(carol.state) === 'Carol');
  assert('host reassigned to Carol', carol.state.players.find((p) => p.name === 'Carol').isHost);

  // Carol leaves -> room should be emptied/cleared
  carol.send({ type: 'leaveRoom' });
  await wait(400);

  // Reuse the (now free) code: a fresh host should be able to create a new game
  const fresh = conn('Dana', code);
  await waitFor(() => fresh.open, 4000, 'fresh open');
  fresh.send({ type: 'createRoom', name: 'Dana' });
  await waitFor(() => fresh.state, 4000, 'fresh state');
  assert('freed code hosts a fresh game', fresh.state.players.length === 1 && fresh.state.players[0].name === 'Dana' && fresh.state.players[0].isHost);

  [host, bob, carol, fresh].forEach((c) => { try { c.ws.close(); } catch {} });
  const failed = results.filter((r) => !r).length;
  console.log(`\n${failed === 0 ? '🎉 ALL PASSED' : '⚠️  ' + failed + ' FAILED'} (${results.length} checks)`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error('TEST ERROR:', e.message); process.exit(2); });
