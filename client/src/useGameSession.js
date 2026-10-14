import { useEffect, useReducer, useRef } from 'react';

const STORAGE_KEY = 'jeopardy-player';

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readLeft() {
  const left = readStorage().left;
  if (!left || typeof left !== 'object') return {};
  return Object.fromEntries(
    Object.entries(left).filter((entry) => typeof entry[0] === 'string' && typeof entry[1] === 'string'),
  );
}

function writeStorage({ sessionId, playerId, left = readLeft() }) {
  const next = {};
  if (typeof sessionId === 'string' && typeof playerId === 'string') {
    next.sessionId = sessionId;
    next.playerId = playerId;
  }
  if (Object.keys(left).length > 0) next.left = left;
  if (!next.sessionId && !next.left) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function readStoredSession() {
  const parsed = readStorage();
  if (typeof parsed.sessionId !== 'string' || typeof parsed.playerId !== 'string') return null;
  return parsed;
}

function socketUrl() {
  const configured = import.meta.env.VITE_WS_URL;
  if (typeof configured === 'string' && configured.trim() !== '') return configured.trim();
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

function reducer(state, action) {
  switch (action.type) {
    case 'connected':
      return { ...state, connected: true };
    case 'disconnected':
      return { ...state, connected: false, pending: false };
    case 'session':
      return {
        ...state,
        screen: 'session',
        session: action.session,
        error: null,
        pending: false,
      };
    case 'lobby':
      return { ...state, screen: 'lobby', session: null, error: null, pending: false };
    case 'show-create':
      return { ...state, screen: 'create', error: null };
    case 'show-lobby':
      return { ...state, screen: 'lobby', error: null };
    case 'pending':
      return { ...state, pending: true, error: null };
    case 'error':
      return { ...state, error: action.message, pending: false };
    default:
      return state;
  }
}

export function useGameSession() {
  const socketRef = useRef(null);
  const [state, dispatch] = useReducer(reducer, null, () => ({
    connected: false,
    screen: readStoredSession() ? 'restoring' : 'lobby',
    session: null,
    error: null,
    pending: false,
  }));

  useEffect(() => {
    let socket;
    let timer;
    let stopped = false;

    const connect = () => {
      socket = new WebSocket(socketUrl());
      socketRef.current = socket;

      socket.onopen = () => {
        dispatch({ type: 'connected' });
        const stored = readStoredSession();
        if (stored) socket.send(JSON.stringify({ type: 'resume', ...stored }));
      };

      socket.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        if (message.type === 'session') {
          const left = readLeft();
          delete left[message.sessionId];
          writeStorage({
            sessionId: message.sessionId,
            playerId: message.playerId,
            left,
          });
          dispatch({ type: 'session', session: message });
          return;
        }

        if (message.type === 'lobby') {
          const left = readLeft();
          if (typeof message.sessionId === 'string' && typeof message.playerId === 'string') {
            left[message.sessionId] = message.playerId;
          }
          writeStorage({ left });
          dispatch({ type: 'lobby' });
          return;
        }

        if (message.type === 'error') {
          dispatch({ type: 'error', message: message.message ?? 'Something went wrong.' });
        }
      };

      socket.onclose = () => {
        if (stopped) return;
        if (socketRef.current === socket) socketRef.current = null;
        dispatch({ type: 'disconnected' });
        timer = setTimeout(connect, 1000);
      };
    };

    connect();

    return () => {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, []);

  function send(message) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      dispatch({ type: 'error', message: 'Not connected to the server.' });
      return false;
    }
    socket.send(JSON.stringify(message));
    return true;
  }

  return {
    ...state,
    showCreate() {
      dispatch({ type: 'show-create' });
    },
    showLobby() {
      dispatch({ type: 'show-lobby' });
    },
    createGame(url) {
      dispatch({ type: 'pending' });
      if (!send({ type: 'create', url })) return;
    },
    joinGame(sessionId) {
      const stored = readStoredSession();
      const normalized = sessionId.trim().toUpperCase();
      const playerId = stored?.sessionId === normalized ? stored.playerId : readLeft()[normalized];
      dispatch({ type: 'pending' });
      send({
        type: 'join',
        sessionId: normalized,
        playerId,
      });
    },
    leaveGame() {
      send({ type: 'leave' });
    },
    selectQuestion(column, row) {
      send({ type: 'select', column, row });
    },
    submitWager(amount) {
      send({ type: 'wager', amount });
    },
    submitAnswer(text) {
      send({ type: 'answer', text });
    },
    skipAnswer() {
      send({ type: 'skip' });
    },
    reportCorrect(correct) {
      send({ type: 'judge', correct });
    },
    continuePlay() {
      send({ type: 'continue' });
    },
  };
}
