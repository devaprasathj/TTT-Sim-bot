# 🤖 Inner Monologue Simulator

> *A chatbot that thinks before it speaks — literally.*

A full-stack conversational AI that simulates a genuine **inner stream of consciousness** before replying. Instead of firing back a flat answer, it shows its raw thoughts unfolding in real time, then settles into a structured, reflective response — complete with contextual follow-up prompts and persistent session memory.

<div align="center">

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Firebase](https://img.shields.io/badge/Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)

</div>

---

## 🚀 Live Demo

👉 **[Live Application Link](https://ttt-sim-bot.onrender.com)**

---

## 🎨 Design Philosophy

The interface leans into a **minimal, glassmorphic aesthetic** — soft gradient backgrounds (violet → indigo → pink), frosted translucent panels, floating rounded message bubbles, and layered drop shadows that give flat elements a sense of physical depth. No heavy UI kit — every visual cue is handcrafted in pure CSS:

- **Soft depth, not flat design** — subtle box-shadows and layered blur (`backdrop-filter`) simulate a light 3D lift on cards, bubbles, and the input dock, without relying on any 3D/WebGL library.
- **Two-tier message rendering** — an *italicized "raw thought" bubble* streams in first (the unfiltered inner monologue), followed by a clean, structured *final response* bubble — visually separating cognition from communication.
- **Calm gradient canvas** — a slow-shifting pastel gradient backdrop keeps the focus on the conversation instead of the chrome.
- **Micro-interactions** — hover lifts, smooth fade/slide transitions on new messages, and a pulsing avatar while the bot is "thinking."

| Raw Thought | Structured Reply |
|---|---|
| *Italic, muted tone — the model's unfiltered internal reasoning* | Clear, actionable, broken into steps with a follow-up question prompt |

---

## ✨ Features

| | |
|---|---|
| 🧠 | **Inner Monologue Engine** — a distinct "thinking pass" is generated and streamed before the final answer, mimicking genuine reflective cognition |
| 💡 | **Structured Reflections** — final responses are auto-organized into insight → suggestion → next step |
| ❓ | **Context-Aware Follow-ups** — dynamically generated follow-up questions keep the conversation flowing naturally |
| 🖼️ | **Multimodal Input** — upload images alongside text; the model analyzes both together |
| 💾 | **Persistent Sessions** — conversations are saved to Firebase Firestore against a secure guest token, so history reloads across visits |
| 🔁 | **Fault-Tolerant AI Layer** — multi-model fallback chain (Gemini 1.5 Flash + backups) with exponential backoff retry logic to gracefully absorb rate limits |
| 📬 | **Feedback Pipeline** — built-in Nodemailer route to email feedback straight from the app |

---

## 🛠️ Tech Stack

**Frontend** — Vanilla HTML5, CSS3 (Flexbox/Grid, glassmorphism, custom animations), Modern ES6+ JavaScript. No frameworks — 100% hand-built for full control over the visual language. Hosted on **Vercel**.

**Backend** — Node.js + Express, CORS, Nodemailer, native Crypto module for secure token generation. Hosted on **Render/Vercel**.

**Database** — Google Firebase Firestore (guest-token-scoped chat history).

**AI Model** — Google Gemini API (`gemini-1.5-flash`, with fallback chain).

---

## 🗂️ Project Structure

```
inner-monologue-simulator/
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── backend/
│   ├── server.js
│   ├── routes/
│   ├── controllers/
│   ├── utils/
│   │   └── retry.js        # exponential backoff logic
│   ├── .env.example
│   └── package.json
└── README.md
```

---

## ⚙️ Environment Variables

Create a `.env` file inside `/backend`:

```env
PORT=5000
GEMINI_API_KEY=your_actual_gemini_api_key_here
EMAIL_USER=your_gmail_for_feedback@gmail.com
EMAIL_PASS=your_google_app_specific_password
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key
```

---

## 🧑‍💻 Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/your-username/inner-monologue-simulator.git
cd inner-monologue-simulator

# 2. Install backend dependencies
cd backend
npm install

# 3. Configure your .env file (see above)

# 4. Start the backend server
npm start

# 5. Open the frontend
# Simply open frontend/index.html in your browser,
# or serve it with any static server (e.g. Live Server / Vercel dev)
```

---

## 🔄 How It Works

```
User Input (text/image)
        │
        ▼
Frontend sends request → Backend (Express)
        │
        ▼
Backend calls Gemini API
   ├── Pass 1: generate raw "inner thought" stream
   └── Pass 2: generate structured reflective response + follow-ups
        │
        ▼
Response streamed back → rendered as two-tier bubbles
        │
        ▼
Session saved to Firestore (linked to guest token)
```

---

## 📌 Roadmap

- [ ] Voice input/output support
- [ ] Theming toggle (light/dark gradient palettes)
- [ ] Exportable conversation transcripts (PDF/Markdown)
- [ ] Authenticated (non-guest) user accounts

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome. Feel free to check the [issues page](https://github.com/your-username/inner-monologue-simulator/issues).

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
