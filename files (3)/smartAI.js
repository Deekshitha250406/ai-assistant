/**
 * ARIA Smart Local AI Engine
 * ──────────────────────────
 * Powers the demo mode — no API key required.
 * Handles intents: reminders, scheduling, greetings, time/date,
 * jokes, help, and more with context-aware fallbacks.
 *
 * Usage (browser inline or import in Vite build):
 *   const result = smartReply(userMessage);
 *   // result = { text: "...", reminder: null | { title, datetime, display } }
 */

const INTENT_RULES = [
  // ── Greetings ──────────────────────────────────────────────────
  {
    pattern: /\b(hi|hello|hey|howdy|yo|sup|greetings)\b/i,
    replies: [
      "Hey! I'm ARIA, your AI voice assistant. How can I help you today?",
      "Hello! Great to hear from you. What's on your mind?",
      "Hi there! Ready to assist — what do you need?",
    ],
  },

  // ── How are you ───────────────────────────────────────────────
  {
    pattern: /\b(how are you|you ok|how do you feel|you good)\b/i,
    replies: [
      "All systems green! Running perfectly. How about you?",
      "Doing great, thanks for asking! What can I help you with?",
    ],
  },

  // ── Capabilities ──────────────────────────────────────────────
  {
    pattern: /\b(what can you do|your features|help me|what are you|capabilities)\b/i,
    replies: [
      "Here's what I can do:\n• 💬 Chat & answer questions\n• ⏰ Set reminders (say 'Remind me to...')\n• 📅 Schedule tasks\n• 🕐 Save conversation history\n• 🎤 Voice input & output\n• 👥 Multi-speaker detection\n\nWhat would you like to try?",
    ],
  },

  // ── Reminders ─────────────────────────────────────────────────
  {
    pattern: /remind|reminder|don't let me forget|alert me|notify me/i,
    fn: (msg) => {
      // Extract time
      const timeMatch = msg.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      // Extract title — remove common preamble
      let title = msg
        .replace(/^.*(remind\s*(me)?\s*(to|about|at|for)?)/i, '')
        .replace(/\s*(at|by|in)\s*\d[\d:apmAMP\s]*/i, '')
        .trim();
      if (!title || title.length < 2) title = 'Reminder';
      title = title.charAt(0).toUpperCase() + title.slice(1);

      // Build datetime
      let dt = new Date();
      if (timeMatch) {
        let h  = parseInt(timeMatch[1]);
        let mn = parseInt(timeMatch[2] || 0);
        const ap = (timeMatch[3] || '').toLowerCase();
        if (ap === 'pm' && h < 12) h += 12;
        if (ap === 'am' && h === 12) h = 0;
        // Assume PM if no period and hour is 1–6 (ambiguous)
        if (!ap && h >= 1 && h <= 6) h += 12;
        dt.setHours(h, mn, 0, 0);
        // If time has passed today, schedule for tomorrow
        if (dt < new Date()) dt.setDate(dt.getDate() + 1);
      } else {
        // Default: 1 hour from now
        dt.setHours(dt.getHours() + 1, 0, 0, 0);
      }

      const display = dt.toLocaleString([], {
        weekday: 'short', hour: '2-digit', minute: '2-digit',
      });

      return {
        text: `Got it! ✅ I've set a reminder: "${title}" for ${display}. I'll notify you when it's time!`,
        reminder: { title, datetime: dt.toISOString(), display },
      };
    },
  },

  // ── Current time ──────────────────────────────────────────────
  {
    pattern: /\b(time now|what time|current time|what's the time)\b/i,
    fn: () => ({
      text: `It's ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} right now.`,
    }),
  },

  // ── Today's date ─────────────────────────────────────────────
  {
    pattern: /\b(today.*date|what.*date|day.*today|what day is it)\b/i,
    fn: () => ({
      text: `Today is ${new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`,
    }),
  },

  // ── Scheduling ────────────────────────────────────────────────
  {
    pattern: /\b(schedule|meeting|appointment|book|calendar|standup)\b/i,
    replies: [
      "I'll help you schedule that! Just tell me the date and time — for example: 'Schedule a meeting tomorrow at 3 PM'",
      "Sure! What date and time works? Say something like 'Schedule standup Monday at 9 AM' and I'll create a reminder.",
    ],
  },

  // ── Weather ───────────────────────────────────────────────────
  {
    pattern: /\b(weather|temperature|forecast|rain|sunny|cloudy)\b/i,
    replies: [
      "I don't have live weather data in demo mode, but I can remind you to check it! Try: 'Remind me to check the weather at 7 AM'",
      "Weather lookups need a connected weather API. But I can set a reminder to check the forecast — just say when!",
    ],
  },

  // ── Jokes ─────────────────────────────────────────────────────
  {
    pattern: /\b(joke|funny|make me laugh|humor|hilarious)\b/i,
    replies: [
      "Why did the AI go to therapy? It had too many deep learning issues! 😄",
      "I told my neural network to take a break. Now it won't stop sending me productivity tips. 🤖",
      "Why don't AIs trust atoms? Because they make up everything — just like a hallucinating LLM! 😂",
      "My machine learning model walked into a bar. The bartender said 'We don't serve your type.' The model said 'That's fine, I'll train myself.' 🍺",
    ],
  },

  // ── Thanks ────────────────────────────────────────────────────
  {
    pattern: /\b(thank|thanks|thank you|thx|ty|cheers)\b/i,
    replies: [
      "You're very welcome! Anything else I can help with? 😊",
      "Happy to help! What's next?",
      "Anytime! That's what I'm here for.",
    ],
  },

  // ── Goodbye ───────────────────────────────────────────────────
  {
    pattern: /\b(bye|goodbye|see you|cya|later|gotta go|take care)\b/i,
    replies: [
      "Goodbye! Come back anytime. Your conversations are saved in Recents. 👋",
      "See you later! I'll be here whenever you need me. 🤖",
      "Take care! Everything's saved — just pick up where we left off next time.",
    ],
  },

  // ── Identity ──────────────────────────────────────────────────
  {
    pattern: /\b(name|who are you|what are you|introduce yourself|tell me about you)\b/i,
    replies: [
      "I'm ARIA — Adaptive Reasoning Intelligence Assistant! I handle voice & text chat, set reminders, manage your schedule, and remember our conversations. Nice to meet you! 🤖",
    ],
  },

  // ── API / Upgrade ─────────────────────────────────────────────
  {
    pattern: /api key|anthropic|upgrade|full mode|real ai|claude/i,
    replies: [
      "To unlock full Claude AI mode: tap ⚙️ Settings → paste your Anthropic API key (free at console.anthropic.com). In demo mode I still handle reminders, scheduling, and smart conversation!",
    ],
  },

  // ── Yes/affirmations ─────────────────────────────────────────
  {
    pattern: /^\s*(yes|yeah|yep|sure|ok|okay|alright|definitely|absolutely|yup)\s*$/i,
    replies: [
      "Great! How can I help?",
      "Perfect! What would you like to do?",
      "Awesome, let's go! What do you need?",
    ],
  },

  // ── No/negations ─────────────────────────────────────────────
  {
    pattern: /^\s*(no|nope|nah|never mind|cancel|forget it|nevermind)\s*$/i,
    replies: [
      "No problem! Is there something else I can help with?",
      "Sure thing! Let me know if you need anything.",
    ],
  },

  // ── Help ─────────────────────────────────────────────────────
  {
    pattern: /\b(help|assist|support|guide|how do i)\b/i,
    replies: [
      "Of course! Here's what I can do:\n• 💬 Chat — just type or use the mic\n• ⏰ Reminders — say 'Remind me to...'\n• 📅 Schedule — say 'Schedule a meeting...'\n• 🕐 History — check the Recents tab\n• 👥 Multi-speaker — toggle in the chat header\n\nWhat would you like to try?",
    ],
  },
];

/**
 * Main entry point — matches message against intent rules and returns a response.
 *
 * @param {string} message   - User's message
 * @param {Array}  [history] - Previous messages for context (optional)
 * @returns {{ text: string, reminder: Object|null }}
 */
function smartReply(message, history = []) {
  const msg = message.trim();

  for (const rule of INTENT_RULES) {
    if (rule.pattern.test(msg)) {
      if (rule.fn) {
        return rule.fn(msg);
      }
      const replies = rule.replies;
      return { text: replies[Math.floor(Math.random() * replies.length)], reminder: null };
    }
  }

  // Context-aware fallback — peek at recent history
  const recentContext = history.slice(-3).map(h => h.content || '').join(' ').toLowerCase();
  if (recentContext.includes('remind') || recentContext.includes('schedule')) {
    return { text: "Got it! Would you like me to set a reminder for that? Just say the time — like 'at 3 PM'.", reminder: null };
  }

  // Generic fallbacks
  const fallbacks = [
    "That's interesting! In demo mode I'm best at reminders and scheduling. For full answers, add an Anthropic API key in ⚙️ Settings.",
    "I hear you! I'm running in smart demo mode right now. Say 'Remind me to...' to try my scheduling, or add an API key for full Claude AI.",
    "Good question! Full AI mode (with an Anthropic key) unlocks deep answers on any topic. For now — any reminders or tasks I can help with?",
    "Noted! I'll get smarter once you add an Anthropic API key in Settings. Until then, I'm great at scheduling and reminders 😊",
  ];
  return { text: fallbacks[Math.floor(Math.random() * fallbacks.length)], reminder: null };
}

// Export for Vite/ESM builds
if (typeof module !== 'undefined') module.exports = { smartReply, INTENT_RULES };
