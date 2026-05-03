/**
 * ARIA Voice Assistant — Reusable React Hooks
 * Use these when migrating to a Vite/CRA production build.
 *
 * Hooks:
 *   useSpeechRecognition  — Web Speech API wrapper (STT)
 *   useSpeechSynthesis    — Web Speech API wrapper (TTS)
 *   useWebSocket          — Real-time backend connection
 *   useReminders          — Reminder state + notification scheduler
 *   useConversations      — Conversation list management
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ────────────────────────────────────────────────────────────────
// 1. Speech Recognition (STT)
// ────────────────────────────────────────────────────────────────
/**
 * Wraps the browser Web Speech API.
 * Works in Chrome and Edge only.
 *
 * @param {Object} options
 * @param {function} options.onResult  - Called with final transcript string
 * @param {function} options.onInterim - Called with interim (live) transcript
 * @param {string}   options.lang      - BCP-47 language tag, default 'en-US'
 *
 * @returns {{ listening, transcript, startListening, stopListening, supported, error }}
 */
export function useSpeechRecognition({ onResult, onInterim, lang = 'en-US' } = {}) {
  const [listening,  setListening]  = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error,      setError]      = useState(null);
  const recogRef = useRef(null);

  const SR = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  const supported = !!SR;

  const startListening = useCallback(() => {
    if (!SR) {
      setError('Speech recognition not supported. Use Chrome or Edge.');
      return;
    }
    if (listening) return;

    const r = new SR();
    r.continuous      = false;
    r.interimResults  = true;
    r.lang            = lang;

    r.onstart  = () => { setListening(true); setError(null); };
    r.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      setTranscript(final || interim);
      if (interim && onInterim) onInterim(interim);
      if (final) {
        setTranscript('');
        onResult?.(final.trim());
      }
    };
    r.onerror  = (e) => { setError(e.error); setListening(false); };
    r.onend    = ()  => setListening(false);

    recogRef.current = r;
    r.start();
  }, [SR, lang, listening, onResult, onInterim]);

  const stopListening = useCallback(() => {
    recogRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, transcript, startListening, stopListening, supported, error };
}

// ────────────────────────────────────────────────────────────────
// 2. Speech Synthesis (TTS)
// ────────────────────────────────────────────────────────────────
/**
 * Wraps browser SpeechSynthesis for text-to-speech output.
 *
 * @returns {{ speak, stop, speaking, supported }}
 */
export function useSpeechSynthesis() {
  const [speaking,  setSpeaking]  = useState(false);
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);

  const supported = !!synthRef.current;

  const speak = useCallback((text, {
    rate       = 1.05,
    pitch      = 1,
    volume     = 1,
    voiceName  = null,
  } = {}) => {
    if (!synthRef.current || !text) return;
    synthRef.current.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.rate   = rate;
    u.pitch  = pitch;
    u.volume = volume;

    const voices = synthRef.current.getVoices();
    const preferred = voiceName
      ? voices.find(v => v.name.includes(voiceName))
      : voices.find(v =>
          v.name.includes('Samantha') ||
          v.name.includes('Google US English') ||
          v.name.includes('Microsoft Zira')
        );
    if (preferred) u.voice = preferred;

    u.onstart = () => setSpeaking(true);
    u.onend   = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);

    synthRef.current.speak(u);
  }, []);

  const stop = useCallback(() => {
    synthRef.current?.cancel();
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking, supported };
}

// ────────────────────────────────────────────────────────────────
// 3. WebSocket connection to ARIA backend
// ────────────────────────────────────────────────────────────────
/**
 * Manages a persistent WebSocket connection with auto-reconnect.
 *
 * @param {string} userId     - Unique user identifier
 * @param {string} backendUrl - Backend base URL, e.g. 'http://localhost:3001'
 *
 * @returns {{ send, lastMessage, connected, reconnect }}
 */
export function useWebSocket(userId, backendUrl) {
  const [connected,   setConnected]   = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef        = useRef(null);
  const reconnectRef = useRef(null);
  const pingRef      = useRef(null);

  const connect = useCallback(() => {
    if (!backendUrl || !userId) return;
    const wsUrl = backendUrl.replace(/^http/, 'ws') + `?userId=${encodeURIComponent(userId)}`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
        clearTimeout(reconnectRef.current);
        // Heartbeat every 25s
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      ws.onmessage = (e) => {
        try { setLastMessage(JSON.parse(e.data)); } catch {}
      };

      ws.onclose = () => {
        setConnected(false);
        clearInterval(pingRef.current);
        reconnectRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();

      wsRef.current = ws;
    } catch (e) {
      console.error('[WS] Connection error:', e);
      reconnectRef.current = setTimeout(connect, 5000);
    }
  }, [backendUrl, userId]);

  useEffect(() => {
    connect();
    return () => {
      clearInterval(pingRef.current);
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  return { send, lastMessage, connected, reconnect: connect };
}

// ────────────────────────────────────────────────────────────────
// 4. Reminders
// ────────────────────────────────────────────────────────────────
/**
 * Manages reminders with local state + browser notification scheduling.
 *
 * @param {string} apiBase - Backend URL for persisting reminders
 *
 * @returns {{ reminders, addReminder, dismissReminder, removeReminder, upcomingCount }}
 */
export function useReminders(apiBase) {
  const [reminders, setReminders] = useState([]);

  // Request notification permission on mount
  useEffect(() => {
    Notification?.requestPermission?.();
  }, []);

  // Load from backend
  useEffect(() => {
    if (!apiBase) return;
    fetch(`${apiBase}/api/reminders?userId=local`)
      .then(r => r.json())
      .then(data => setReminders(data))
      .catch(() => {});
  }, [apiBase]);

  // Listen for ARIA chat events
  useEffect(() => {
    const handler = (e) => setReminders(p => [...p, e.detail]);
    window.addEventListener('aria-reminder', handler);
    return () => window.removeEventListener('aria-reminder', handler);
  }, []);

  // Notification scheduler
  useEffect(() => {
    const tick = setInterval(() => {
      const now = new Date();
      setReminders(prev => prev.map(r => {
        if (r.status !== 'pending') return r;
        const diff = Math.abs(new Date(r.datetime) - now);
        if (diff < 31000) {
          if (Notification?.permission === 'granted') {
            new Notification('ARIA Reminder 🔔', { body: r.title, icon: '🤖' });
          }
          return { ...r, status: 'triggered' };
        }
        return r;
      }));
    }, 30000);
    return () => clearInterval(tick);
  }, []);

  const addReminder = useCallback((reminder) => {
    const newR = { id: Math.random().toString(36).slice(2), ...reminder, status: 'pending', createdAt: Date.now() };
    setReminders(p => [...p, newR]);
    if (apiBase) {
      fetch(`${apiBase}/api/reminders`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: 'local', ...newR }),
      }).catch(() => {});
    }
    return newR;
  }, [apiBase]);

  const dismissReminder = useCallback((id) => {
    setReminders(p => p.map(r => r.id === id ? { ...r, status: 'done' } : r));
  }, []);

  const removeReminder = useCallback((id) => {
    setReminders(p => p.filter(r => r.id !== id));
  }, []);

  const upcomingCount = reminders.filter(
    r => r.status === 'pending' && new Date(r.datetime) > new Date()
  ).length;

  return { reminders, setReminders, addReminder, dismissReminder, removeReminder, upcomingCount };
}

// ────────────────────────────────────────────────────────────────
// 5. Conversation Manager
// ────────────────────────────────────────────────────────────────
/**
 * Manages the list of all saved conversations.
 *
 * @returns {{ allConvos, saveConvo, deleteConvo, searchConvos }}
 */
export function useConversations() {
  const [allConvos, setAllConvos] = useState([]);

  const saveConvo = useCallback((messages, id, title) => {
    setAllConvos(prev => {
      const existing = prev.find(c => c.id === id);
      if (existing) {
        return prev.map(c => c.id === id
          ? { ...c, messages, updatedAt: Date.now(), title }
          : c
        );
      }
      return [
        { id, title, messages, createdAt: Date.now(), updatedAt: Date.now() },
        ...prev,
      ];
    });
  }, []);

  const deleteConvo = useCallback((id) => {
    setAllConvos(prev => prev.filter(c => c.id !== id));
  }, []);

  const searchConvos = useCallback((query) => {
    if (!query) return allConvos;
    const q = query.toLowerCase();
    return allConvos.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.messages.some(m => m.content.toLowerCase().includes(q))
    );
  }, [allConvos]);

  return { allConvos, setAllConvos, saveConvo, deleteConvo, searchConvos };
}
