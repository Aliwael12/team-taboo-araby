import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from './socket';

const STORAGE_KEY = 'teamtaboo:session';

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
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

export function useGame() {
  const [connected, setConnected] = useState(socket.connected);
  const [state, setState] = useState(null);   // redacted room state from server
  const [remaining, setRemaining] = useState(null); // live turn clock
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle'); // idle | joining | inroom
  const guessListeners = useRef(new Set());

  // Wire socket events once.
  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      // Attempt to restore a prior session on (re)connect.
      const s = loadSession();
      if (s && s.code && s.playerId) {
        socket.emit('rejoin', s, (res) => {
          if (res && res.error) {
            saveSession(null);
          }
        });
      }
    };
    const onDisconnect = () => setConnected(false);
    const onState = (s) => {
      setState(s);
      setStatus('inroom');
      if (s && s.turn && (s.phase === 'turn' || s.phase === 'countdown')) {
        setRemaining(s.turn.remaining);
      }
      if (!s || s.phase === 'lobby' || s.phase === 'gameOver' || s.phase === 'turnEnd') {
        setRemaining(s && s.turn ? s.turn.remaining : null);
      }
    };
    const onTick = ({ remaining }) => setRemaining(remaining);
    const onGuessResult = (payload) => {
      for (const fn of guessListeners.current) fn(payload);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state', onState);
    socket.on('tick', onTick);
    socket.on('guessResult', onGuessResult);
    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('state', onState);
      socket.off('tick', onTick);
      socket.off('guessResult', onGuessResult);
    };
  }, []);

  const createGame = useCallback((name) => {
    setError('');
    setStatus('joining');
    socket.emit('createRoom', { name }, (res) => {
      if (res && res.ok) {
        saveSession({ code: res.code, playerId: res.playerId });
      } else {
        setStatus('idle');
        setError((res && res.error) || 'Could not create the game');
      }
    });
  }, []);

  const joinGame = useCallback((name, code) => {
    setError('');
    setStatus('joining');
    socket.emit('joinRoom', { name, code: (code || '').toUpperCase() }, (res) => {
      if (res && res.ok) {
        saveSession({ code: res.code, playerId: res.playerId });
      } else {
        setStatus('idle');
        setError((res && res.error) || 'Could not join the game');
      }
    });
  }, []);

  const leave = useCallback(() => {
    saveSession(null);
    setState(null);
    setStatus('idle');
    setRemaining(null);
  }, []);

  // Host actions
  const addTeam = useCallback(() => socket.emit('addTeam'), []);
  const removeTeam = useCallback((teamId) => socket.emit('removeTeam', { teamId }), []);
  const assignPlayer = useCallback((playerId, teamId) => socket.emit('assignPlayer', { playerId, teamId }), []);
  const renameTeam = useCallback((teamId, name) => socket.emit('renameTeam', { teamId, name }), []);
  const setSettings = useCallback((s) => socket.emit('setSettings', s), []);
  const startGame = useCallback(
    () =>
      new Promise((resolve) => {
        socket.emit('startGame', {}, (res) => {
          if (res && res.error) setError(res.error);
          resolve(res);
        });
      }),
    []
  );
  const restart = useCallback(() => socket.emit('restart'), []);

  // Guessing
  const submitGuess = useCallback(
    (text) =>
      new Promise((resolve) => {
        socket.emit('submitGuess', { text }, resolve);
      }),
    []
  );
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
