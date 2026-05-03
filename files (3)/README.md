# 🤖 ARIA — AI Voice Assistant v2.1

A complete, production-ready AI Voice Assistant. Open `frontend/index.html` in Chrome to run instantly — no server, no install, no API key required.

---

## 📁 Project Structure

```
ARIA-complete/
├── frontend/
│   └── index.html          ← Complete standalone app (open this!)
│
├── backend/
│   ├── server.js           ← Express + WebSocket backend
│   ├── package.json        ← Backend dependencies
│   ├── .env.example        ← Environment variables template
│   └── src/
│       ├── hooks.js        ← Reusable React hooks (for Vite build)
│       └── smartAI.js      ← Demo-mode local AI engine
│
└── docs/
    ├── README.md           ← This file
    └── GOOGLE_SETUP.md     ← Google Sign-In setup guide
```

---

## ⚡ Quickest Start (30 seconds)

1. Download and unzip this folder
2. Open `frontend/index.html` in **Chrome** or **Edge**
3. Enter your name → click **Launch ARIA**
4. Start chatting, using voice, setting reminders!

> No API key needed. Demo mode uses built-in smart AI.

---

## 🚀 Full Stack Setup (with Backend)

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier: cloud.mongodb.com)
- Anthropic API key (console.anthropic.com)

### Steps

```bash
# 1. Go to backend folder
cd backend

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your keys

# 4. Run the server
npm run dev        # development (auto-reload)
npm start          # production

# Server starts at http://localhost:3001
# Open frontend/index.html in your browser
```

---

## 🌐 Deployment

### Backend → Render.com (Free)
1. Push project to GitHub
2. Go to render.com → New Web Service
3. Connect your repo → set Root Directory to `backend`
4. Build command: `npm install`
5. Start command: `node server.js`
6. Add all env vars from `.env.example`
7. Deploy!

### Frontend → Netlify (Free)
- Drag and drop the `frontend/` folder to netlify.com/drop
- Or use Vercel: `npx vercel --prod` from the frontend folder

---

## ✨ Features

| Feature | How to use |
|---|---|
| 💬 **AI Chat** | Type or speak — powered by Claude or built-in demo AI |
| 🎤 **Voice Input** | Hold the mic button to speak, release to send |
| 🔊 **Voice Output** | ARIA reads every response aloud — click 🔇 to mute |
| 🕐 **Recents** | All conversations auto-saved with title + timestamp |
| ⏰ **Reminders** | Say "Remind me to call John at 5 PM" |
| 📅 **Scheduler** | View, manage, and add reminders in the Schedule tab |
| 👥 **Multi-Speaker** | Toggle in chat header to tag different voices |
| 🔔 **Notifications** | Browser push alerts when reminders are due |
| ⚙️ **Settings** | Add Claude API key, view profile, sign out |

---

## 🔑 Sign In Options

### Option A — Quick Login (Recommended)
Enter your name in the sign-in screen → click **Launch ARIA**
- No account needed
- Works 100% offline (after page load)
- All data stored locally in your browser

### Option B — Google Sign-In
Requires a free Google Client ID. See `docs/GOOGLE_SETUP.md` for the 4-step setup.

### Option C — No Login
In the sign-in screen → "Continue in Demo Mode" (same as Option A without entering a name)

---

## 🤖 AI Modes

### Demo Mode (Default — no key needed)
Built-in smart AI handles:
- Reminders with time parsing
- Scheduling help
- Time/date queries
- Greetings, jokes, help, farewells
- Context-aware responses

### Full Claude Mode (API Key)
In **⚙️ Settings** → paste your Anthropic API key → Save
- Full Claude Sonnet intelligence
- Any question, any topic
- Summarization, writing, coding help
- Still handles reminders the same way

---

## 🔌 Backend API Reference

### REST

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Server status |
| POST | `/api/chat` | Non-streaming Claude response |
| GET | `/api/conversations?userId=` | List conversations |
| POST | `/api/conversations` | Create conversation |
| GET | `/api/conversations/:id/messages` | Get messages |
| DELETE | `/api/conversations/:id` | Delete conversation |
| GET | `/api/reminders?userId=` | List reminders |
| POST | `/api/reminders` | Create reminder |
| PATCH | `/api/reminders/:id` | Update status |
| DELETE | `/api/reminders/:id` | Delete reminder |
| POST | `/api/transcribe` | Audio → text (Deepgram/Whisper) |
| POST | `/api/speak` | Text → audio MP3 (ElevenLabs) |

### WebSocket (`ws://localhost:3001?userId=X`)

**Send:**
```json
{ "type": "chat", "userMessage": "Hello", "messages": [...], "conversationId": "abc" }
{ "type": "ping" }
```

**Receive:**
```json
{ "type": "stream_start" }
{ "type": "stream_chunk", "text": "Hell" }
{ "type": "stream_end", "fullText": "Hello!", "reminder": null }
{ "type": "reminder_due", "reminder": { "title": "...", "datetime": "..." } }
{ "type": "error", "message": "..." }
```

---

## 🗄️ Database Schema (MongoDB)

### conversations
```json
{ "_id": "ObjectId", "userId": "string", "title": "string", "messageCount": 0, "createdAt": "Date", "updatedAt": "Date" }
```

### messages
```json
{ "_id": "ObjectId", "conversationId": "string", "role": "user|assistant", "content": "string", "speaker": 0, "reminder": {}, "ts": "Date" }
```

### reminders
```json
{ "_id": "ObjectId", "userId": "string", "title": "string", "datetime": "Date", "display": "string", "status": "pending|triggered|done|deleted", "createdAt": "Date" }
```

---

## 🛠️ Upgrading Voice Quality

### Production STT — Deepgram
```bash
# .env
DEEPGRAM_API_KEY=your_key_here
```
Free at deepgram.com — much better than browser Web Speech API.

### Production TTS — ElevenLabs
```bash
# .env
ELEVENLABS_API_KEY=your_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Rachel voice
```
Free tier at elevenlabs.io — extremely natural sounding.

---

## 📝 License

MIT — use it for anything, including hackathons and commercial projects.
