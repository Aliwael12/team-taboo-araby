import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'teamtaboo:session';
const RECONNECT_BASE_MS = 350;
const RECONNECT_MAX_MS = 5000;
const HEARTBEAT_MS = 20000;
const STALE_CONN_MS = 50000;

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

function scrubRoomFromUrl() {
  try {
    const u = new URL(location.href);
    if (u.searchParams.has('room') || u.searchParams.has('code')) {
      u.searchParams.delete('room');
      u.searchParams.delete('code');
      history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
    }
  } catch {}
}

export function useGame() {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle'); // idle | joining | inroom
  const [clockOffset, setClockOffset] = useState(0); // serverNow - clientNow

  const wsRef = useRef(null);
  const sessionRef = useRef(null);   // { code, playerId }
  const helloRef = useRef(null);     // first message to send on open
  const leftRef = useRef(false);     // intentional leave -> no reconnect
  const statusRef = useRef('idle');
  const queueRef = useRef([]);       // messages typed while offline
  const retryRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const lastPongRef = useRef(Date.now());
  const guessSeqRef = useRef(0);
  const guessListeners = useRef(new Set());
  const offsetRef = useRef(0);

  const setStatusBoth = useCallback((s) => { statusRef.current = s; setStatus(s); }, []);

  // Queue-aware send: taps made while the socket is down are delivered the
  // moment we reconnect instead of being silently dropped.
  const send = useCallback((obj) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify(obj)); return; } catch {}
    }
    if (queueRef.current.length < 30) queueRef.current.push(obj);
  }, []);

  const resetToHome = useCallback((message) => {
    leftRef.current = true;
    sessionRef.current = null;
    helloRef.current = null;
    queueRef.current = [];
    saveSession(null);
    try { wsRef.current && wsRef.current.close(); } catch {}
    setState(null);
    setStatusBoth('idle');
    if (message !== undefined) setError(message);
    scrubRoomFromUrl();
  }, [setStatusBoth]);

  // Apply a tiny `wordSolved` delta to local state (no full-state round trip).
  const applyWordSolved = (prev, msg) => {
    if (!prev || !prev.turn || prev.turn.index !== msg.turnIndex) return prev;
    const turn = { ...prev.turn, solvedCount: msg.solvedCount };
    if (Array.isArray(turn.words) && turn.words.length) {
      turn.words = turn.words.map((w, i) =>
        i === msg.index
          ? { ...w, solved: true, points: msg.points, status: msg.status, solvedByName: msg.solvedByName }
          : w
      );
    }
    const teams = prev.teams.map((t) => (t.id === msg.teamId ? { ...t, score: msg.teamScore } : t));
    return { ...prev, turn, teams };
  };

  // Open (or reopen) the socket for a room, sending `hello` once connected.
  const open = useCallback((code, hello) => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    leftRef.current = false;
    helloRef.current = hello;
    try { if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); } } catch {}
    const ws = new WebSocket(wsUrl(code));
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      retryRef.current = 0;
      lastPongRef.current = Date.now();
      if (helloRef.current) {
        try { ws.send(JSON.stringify(helloRef.current)); } catch {}
      }
      // Flush anything typed while offline.
      const q = queueRef.current;
      queueRef.current = [];
      for (const m of q) { try { ws.send(JSON.stringify(m)); } catch {} }
    };

    ws.onclose = () => {
      setConnected(false);
      scheduleReconnect();
    };

    ws.onmessage = (ev) => {
      if (ev.data === 'pong') { lastPongRef.current = Date.now(); return; }
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      lastPongRef.current = Date.now(); // any traffic proves liveness

      if (msg.type === 'joined') {
        sessionRef.current = { code: msg.code, playerId: msg.playerId };
        saveSession(sessionRef.current);
        setStatusBoth('inroom');
      } else if (msg.type === 'state') {
        if (typeof msg.state.serverNow === 'number') {
          const off = msg.state.serverNow - Date.now();
          if (Math.abs(off - offsetRef.current) > 300) { offsetRef.current = off; setClockOffset(off); }
        }
        setState(msg.state);
        setStatusBoth('inroom');
      } else if (msg.type === 'wordSolved') {
        setState((prev) => applyWordSolved(prev, msg));
      } else if (msg.type === 'guessResult') {
        for (const fn of guessListeners.current) fn(msg);
      } else if (msg.type === 'kicked') {
        resetToHome('You were removed from the room by the host.');
      } else if (msg.type === 'error') {
        if (statusRef.current !== 'inroom') {
          resetToHome(msg.message || 'Something went wrong');
        } else {
          setError(msg.message || 'Something went wrong');
        }
      }
    };
  }, [resetToHome, setStatusBoth]);

  const tryReconnect = useCallback(() => {
    if (leftRef.current || !sessionRef.current) return;
    const ws = wsRef.current;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    open(sessionRef.current.code, { type: 'rejoin', playerId: sessionRef.current.playerId });
  }, [open]);

  const scheduleReconnect = useCallback(() => {
    if (leftRef.current || !sessionRef.current) return;
    if (reconnectTimerRef.current) return;
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * Math.pow(1.6, retryRef.current++));
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      tryReconnect();
    }, delay);
  }, [tryReconnect]);

  // Restore a prior session on first mount.
  useEffect(() => {
    const s = loadSession();
    if (s && s.code && s.playerId) {
      sessionRef.current = s;
      setStatusBoth('joining');
      open(s.code, { type: 'rejoin', playerId: s.playerId });
    }
    return () => {
      leftRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      try { wsRef.current && wsRef.current.close(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconnect the instant the app becomes visible / the network returns —
  // mobile browsers kill sockets when the screen locks or the tab backgrounds.
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState !== 'visible') return;
      if (leftRef.current || !sessionRef.current) return;
      retryRef.current = 0;
      const ws = wsRef.current;
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) tryReconnect();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    window.addEventListener('focus', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
      window.removeEventListener('focus', wake);
    };
  }, [tryReconnect]);

  // Heartbeat: keeps NATs from dropping idle sockets and detects half-open
  // connections (send succeeds but nothing comes back) so we reconnect fast.
  useEffect(() => {
    const id = setInterval(() => {
      const ws = wsRef.current;
      if (!sessionRef.current || leftRef.current) return;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send('ping'); } catch {}
        if (document.visibilityState === 'visible' && Date.now() - lastPongRef.current > STALE_CONN_MS) {
          try { ws.close(); } catch {} // triggers reconnect
        }
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, []);

  const createGame = useCallback(async (name) => {
    setError('');
    setStatusBoth('joining');
    try {
      const res = await fetch('/api/new');
      const { code } = await res.json();
      queueRef.current = [];
      open(code, { type: 'createRoom', name });
    } catch {
      setStatusBoth('idle');
      setError('Could not reach the server');
    }
  }, [open, setStatusBoth]);

  const joinGame = useCallback((name, code) => {
    setError('');
    setStatusBoth('joining');
    queueRef.current = [];
    open((code || '').toUpperCase(), { type: 'joinRoom', name });
  }, [open, setStatusBoth]);

  const leave = useCallback(() => {
    const ws = wsRef.current;
    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'leaveRoom' }));
      }
    } catch {}
    leftRef.current = true;
    sessionRef.current = null;
    helloRef.current = null;
    queueRef.current = [];
    saveSession(null);
    // Give the leave frame a beat to flush before closing.
    setTimeout(() => { try { ws && ws.close(); } catch {} }, 80);
    setState(null);
    setStatusBoth('idle');
    setError('');
    scrubRoomFromUrl();
  }, [setStatusBoth]);

  // Host / gameplay actions.
  const addTeam = useCallback(() => send({ type: 'addTeam' }), [send]);
  const removeTeam = useCallback((teamId) => send({ type: 'removeTeam', teamId }), [send]);
  const assignPlayer = useCallback((playerId, teamId) => send({ type: 'assignPlayer', playerId, teamId }), [send]);
  const kickPlayer = useCallback((playerId) => send({ type: 'kickPlayer', playerId }), [send]);
  const renameTeam = useCallback((teamId, name) => send({ type: 'renameTeam', teamId, name }), [send]);
  const setSettings = useCallback((s) => send({ type: 'setSettings', ...s }), [send]);
  const startGame = useCallback(() => send({ type: 'startGame' }), [send]);
  const startTurn = useCallback(() => send({ type: 'startTurn' }), [send]);
  const skipTurn = useCallback(() => send({ type: 'skipTurn' }), [send]);
  const restart = useCallback(() => send({ type: 'restart' }), [send]);

  // Returns a client id so the UI can show the guess optimistically and
  // reconcile when the server's verdict arrives.
  const submitGuess = useCallback((text) => {
    const id = `g${++guessSeqRef.current}-${Date.now() % 100000}`;
    send({ type: 'guess', id, text });
    return id;
  }, [send]);

  const onGuessResult = useCallback((fn) => {
    guessListeners.current.add(fn);
    return () => guessListeners.current.delete(fn);
  }, []);

  return {
    connected, state, error, status, clockOffset, setError,
    createGame, joinGame, leave,
    addTeam, removeTeam, assignPlayer, kickPlayer, renameTeam, setSettings,
    startGame, startTurn, skipTurn, restart,
    submitGuess, onGuessResult,
  };
}
