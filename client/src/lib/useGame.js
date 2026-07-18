import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'teamtaboo:session';

function loadSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}
function saveSession(s) {
  if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  else localStorage.removeItem(STORAGE_KEY);
}

// Read a room code from the URL (?room=CODE or ?code=CODE or /room/CODE).
export function codeFromUrl() {
  const params = new URLSearchParams(location.search);
  const q = params.get('room') || params.get('code');
  if (q) return q.toUpperCase();
  const m = location.pathname.match(/\/room\/([a-z0-9]+)/i);
  return m ? m[1].toUpperCase() : '';
}

const wsUrl = (code) =>
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/room/${code}/ws`;

export function useGame() {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle'); // idle | joining | inroom

  const wsRef = useRef(null);
  const sessionRef = useRef(null);     // { code, playerId }
  const helloRef = useRef(null);       // first message to send on open
  const leftRef = useRef(false);       // intentional leave -> no reconnect
  const guessListeners = useRef(new Set());

  const send = useCallback((obj) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }, []);

  // Open (or reopen) the socket for a room, sending `hello` once connected.
  const open = useCallback((code, hello) => {
    leftRef.current = false;
    helloRef.current = hello;
    try { if (wsRef.current) wsRef.current.close(); } catch {}
    const ws = new WebSocket(wsUrl(code));
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (helloRef.current) send(helloRef.current);
    };
    ws.onclose = () => {
      setConnected(false);
      // Auto-reconnect (as a rejoin) unless the user intentionally left.
      if (!leftRef.current && sessionRef.current) {
        setTimeout(() => {
          if (leftRef.current || !sessionRef.current) return;
          open(sessionRef.current.code, { type: 'rejoin', playerId: sessionRef.current.playerId });
        }, 1000);
      }
    };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'joined') {
        sessionRef.current = { code: msg.code, playerId: msg.playerId };
        saveSession(sessionRef.current);
        setStatus('inroom');
      } else if (msg.type === 'state') {
        setState(msg.state);
        setStatus('inroom');
      } else if (msg.type === 'guessResult') {
        for (const fn of guessListeners.current) fn(msg);
      } else if (msg.type === 'error') {
        setError(msg.message || 'Something went wrong');
        // A join/create that failed: drop back to the home screen.
        if (status !== 'inroom' && !state) {
          leftRef.current = true;
          sessionRef.current = null;
          saveSession(null);
          setStatus('idle');
          try { ws.close(); } catch {}
        }
      }
    };
  }, [send, state, status]);

  // Restore a prior session on first mount.
  useEffect(() => {
    const s = loadSession();
    if (s && s.code && s.playerId) {
      sessionRef.current = s;
      setStatus('joining');
      open(s.code, { type: 'rejoin', playerId: s.playerId });
    }
    return () => { leftRef.current = true; try { wsRef.current && wsRef.current.close(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive the on-screen countdown from the authoritative turn deadline.
  useEffect(() => {
    if (!state || state.phase !== 'turn' || !state.turn || !state.turn.deadline) return;
    const dl = state.turn.deadline;
    const upd = () => setRemaining(Math.max(0, Math.ceil((dl - Date.now()) / 1000)));
    upd();
    const id = setInterval(upd, 250);
    return () => clearInterval(id);
  }, [state && state.phase, state && state.turn && state.turn.deadline]);

  const createGame = useCallback(async (name) => {
    setError('');
    setStatus('joining');
    try {
      const res = await fetch('/api/new');
      const { code } = await res.json();
      open(code, { type: 'createRoom', name });
    } catch {
      setStatus('idle');
      setError('Could not reach the server');
    }
  }, [open]);

  const joinGame = useCallback((name, code) => {
    setError('');
    setStatus('joining');
    open((code || '').toUpperCase(), { type: 'joinRoom', name });
  }, [open]);

  const leave = useCallback(() => {
    // Tell the server to remove us from the room, then close + forget.
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'leaveRoom' }));
      }
    } catch {}
    leftRef.current = true;
    sessionRef.current = null;
    helloRef.current = null;
    saveSession(null);
    setTimeout(() => { try { wsRef.current && wsRef.current.close(); } catch {} }, 50);
    setState(null);
    setStatus('idle');
    setRemaining(null);
    setError('');
    // Drop ?room=/?code= so a refresh starts on a clean home screen.
    try {
      const u = new URL(location.href);
      if (u.searchParams.has('room') || u.searchParams.has('code')) {
        u.searchParams.delete('room');
        u.searchParams.delete('code');
        history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
      }
    } catch {}
  }, []);

  // Host / gameplay actions (all fire-and-forget over the socket).
  const addTeam = useCallback(() => send({ type: 'addTeam' }), [send]);
  const removeTeam = useCallback((teamId) => send({ type: 'removeTeam', teamId }), [send]);
  const assignPlayer = useCallback((playerId, teamId) => send({ type: 'assignPlayer', playerId, teamId }), [send]);
  const renameTeam = useCallback((teamId, name) => send({ type: 'renameTeam', teamId, name }), [send]);
  const setSettings = useCallback((s) => send({ type: 'setSettings', ...s }), [send]);
  const startGame = useCallback(() => send({ type: 'startGame' }), [send]);
  const restart = useCallback(() => send({ type: 'restart' }), [send]);
  const submitGuess = useCallback((text) => send({ type: 'guess', text }), [send]);

  const onGuessResult = useCallback((fn) => {
    guessListeners.current.add(fn);
    return () => guessListeners.current.delete(fn);
  }, []);

  return {
    connected, state, remaining, error, status, setError,
    createGame, joinGame, leave,
    addTeam, removeTeam, assignPlayer, renameTeam, setSettings, startGame, restart,
    submitGuess, onGuessResult,
  };
}
