import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import crypto from 'crypto'; // FIX: Ensures randomUUID() functions perfectly at runtime

// Import Firebase modules
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';

// Load environment variables from .env file
dotenv.config();

const app = express();
const preferredPort = Number(process.env.PORT || 3000);
const maxPortAttempts = 10;

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDC2uQUgkoiaNrT0CCuGW8-9UqwPI1KRNk",
  authDomain: "chatbot-96752.firebaseapp.com",
  projectId: "chatbot-96752",
  storageBucket: "chatbot-96752.firebasestorage.app",
  messagingSenderId: "673546288383",
  appId: "1:673546288383:web:e049f04fbab34c90b9a0ca",
  measurementId: "G-BME1V86PQ1"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Initialize Firebase
let firebaseApp;
let db;
try {
    firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
    console.log('Firebase app and Firestore initialized successfully.');
} catch (e) {
    console.error('Error initializing Firebase services:', e);
    console.warn('Firebase services might not be available. Saving will likely fail.');
}

const currentUserId = crypto.randomUUID();
console.log('Using local guest session ID:', currentUserId);

// --- Configuration for Gemini API ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

console.log(`--- Server Starting ---`);
console.log(`GEMINI_API_KEY loaded: ${!!GEMINI_API_KEY}`);
if (!GEMINI_API_KEY) {
    console.warn('WARNING: GEMINI_API_KEY is not loaded. Please check your .env file.');
}

// --- Middleware Setup ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Routes ---

app.get('/', (req, res) => {
    res.send('✅ Chatbot backend is running.');
});

app.post('/api/chat', async (req, res) => {
    const userText = req.body?.currentMessage?.parts?.[0]?.text?.trim() || '';
    const fileData = req.body?.currentMessage?.parts?.[1]?.inline_data || null;

    const systemInstruction = `You are an Inner Monologue Simulator.
Respond ONLY to the text after USER_INPUT.
Rules:
- Never invent situations.
- Never assume emotions.
- Keep thoughts relevant.
- Greetings should receive greeting responses.
- Problems should receive problem-related thoughts.
- Questions should receive curious thoughts.

Output:
🧠 Thoughts:
...
💡 Reflection:
...
✨ Suggestions:
...
❓ Follow-up:
...`;

    const parts = [{ text: systemInstruction }];

    if (userText) {
        parts.push({ text: `USER_INPUT: ${userText}` });
    }

    if (fileData?.data && fileData?.mime_type) {
        parts.push({
            inlineData: {
                mimeType: fileData.mime_type,
                data: fileData.data
            }
        });
        parts.push({ text: `The user has also provided an image with their input. Analyze it naturally.` });
    }

    const chatHistory = req.body.history || [];
    const contents = [
        ...chatHistory,
        { role: 'user', parts: parts }
    ];

    const requestBody = { contents: contents };

    const MAX_RETRIES = 3;
    const BASE_DELAY = 1000;

    async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await fetch(url, options);
                const data = await response.json();

                if (!response.ok) {
                    const rawErrorMessage = data?.error?.message || 'Unknown error from Gemini API.';
                    if (response.status === 429 && attempt < retries) {
                        const delay = BASE_DELAY * Math.pow(2, attempt);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    return { error: rawErrorMessage, status: response.status };
                }
                return { data, status: response.status };
            } catch (err) {
                if (attempt < retries) {
                    const delay = BASE_DELAY * Math.pow(2, attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                throw err;
            }
        }
    }

    const result = await fetchWithRetry(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (result.error) {
        return res.status(result.status || 500).json({ error: result.error });
    }

    const data = result.data;
    const rawReply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    let innerMonologue = '';
    let reflection = '';
    let suggestions = [];
    let userFacingResponse = 'I couldn\'t generate a response. Please try again.';
    let suggestedQuestions = [];

    if (rawReply) {
        const innerThoughtsMarker = '🧠 Thoughts:';
        const reflectionMarker = '💡 Reflection:';
        const suggestionsMarker = '✨ Suggestions:';
        const followUpMarker = '❓ Follow-up:';

        const innerThoughtsStart = rawReply.indexOf(innerThoughtsMarker);
        const reflectionStart = rawReply.indexOf(reflectionMarker);
        const suggestionsStart = rawReply.indexOf(suggestionsMarker);
        const followUpStart = rawReply.indexOf(followUpMarker);

        const hasRequired = innerThoughtsStart !== -1 && reflectionStart !== -1 && followUpStart !== -1;
        const correctOrder = innerThoughtsStart < reflectionStart && reflectionStart < followUpStart;

        if (hasRequired && correctOrder) {
            let rawThoughts = rawReply.substring(innerThoughtsStart + innerThoughtsMarker.length, reflectionStart).trim();
            innerMonologue = rawThoughts.replace(/\n+/g, ' ').trim();

            const hasSuggestions = suggestionsStart !== -1 && suggestionsStart > reflectionStart && suggestionsStart < followUpStart;

            if (hasSuggestions) {
                let rawReflection = rawReply.substring(reflectionStart + reflectionMarker.length, suggestionsStart).trim();
                reflection = rawReflection.replace(/\n+/g, ' ').trim();

                let rawSuggestions = rawReply.substring(suggestionsStart + suggestionsMarker.length, followUpStart).trim();
                suggestions = rawSuggestions
                    .split('\n')
                    .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
                    .filter(s => s.length > 0);

                userFacingResponse = `${reflection}\n\n${rawSuggestions}`;
            } else {
                let rawReflection = rawReply.substring(reflectionStart + reflectionMarker.length, followUpStart).trim();
                reflection = rawReflection.replace(/\n+/g, ' ').trim();
                userFacingResponse = reflection;
            }

            let rawFollowUp = rawReply.substring(followUpStart + followUpMarker.length).trim();
            suggestedQuestions = rawFollowUp
                .split('\n')
                .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
                .filter(q => q.length > 0)
                .slice(0, 2);
        } else if (innerThoughtsStart !== -1 && reflectionStart !== -1) {
            let rawThoughts = rawReply.substring(innerThoughtsStart + innerThoughtsMarker.length, reflectionStart).trim();
            innerMonologue = rawThoughts.replace(/\n+/g, ' ').trim();
            let rawReflection = rawReply.substring(reflectionStart).trim();
            userFacingResponse = rawReflection.replace(/\n+/g, ' ').trim();
        } else {
            userFacingResponse = rawReply;
        }
    }

    const MAX_USER_FACING_LENGTH = 800;
    const MAX_MONOLOGUE_LENGTH = 400;
    const MAX_QUESTION_LENGTH = 150;

    if (innerMonologue.length > MAX_MONOLOGUE_LENGTH) {
        innerMonologue = innerMonologue.substring(0, innerMonologue.lastIndexOf(' ', MAX_MONOLOGUE_LENGTH)) + '...';
    }

    if (userFacingResponse.length > MAX_USER_FACING_LENGTH) {
        userFacingResponse = userFacingResponse.substring(0, userFacingResponse.lastIndexOf(' ', MAX_USER_FACING_LENGTH)) + '...';
    }

    suggestedQuestions = suggestedQuestions.map(q =>
        q.length > MAX_QUESTION_LENGTH ? q.substring(0, q.lastIndexOf(' ', MAX_QUESTION_LENGTH)) + '...' : q
    );

    res.json({
        innerMonologue: innerMonologue,
        reflection: reflection,
        suggestions: suggestions,
        userFacingResponse: userFacingResponse,
        suggestedQuestions: suggestedQuestions
    });
});

app.post('/api/save-chat', async (req, res) => {
    const { history } = req.body;
    if (!history || !Array.isArray(history) || history.length === 0) {
        return res.status(400).json({ error: 'No chat history provided to save.' });
    }
    if (!db) {
        return res.status(500).json({ error: 'Firebase services not ready.' });
    }

    try {
        const chatCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/chat_histories`);
        const docRef = await addDoc(chatCollectionRef, {
            userId: currentUserId,
            timestamp: new Date(),
            chat: history
        });
        res.status(200).json({ message: 'Chat history saved successfully!', chatId: docRef.id });
    } catch (error) {
        res.status(500).json({ error: `Failed to save chat history: ${error.message}` });
    }
});

app.get('/api/load-chats', async (req, res) => {
    if (!db) {
        return res.status(500).json({ error: 'Firebase services not ready.' });
    }

    try {
        const chatCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/chat_histories`);
        const q = query(chatCollectionRef);
        const querySnapshot = await getDocs(q);

        const chats = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const firstMessageText = data.chat && data.chat.length > 0 && data.chat[0].text
                ? data.chat[0].text.substring(0, 50) + (data.chat[0].text.length > 50 ? '...' : '')
                : 'No message preview';
            chats.push({
                id: doc.id,
                timestamp: data.timestamp ? data.timestamp.toDate().toLocaleString() : 'Unknown Date',
                preview: firstMessageText
            });
        });

        chats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.status(200).json({ chats: chats });
    } catch (error) {
        res.status(500).json({ error: `Failed to load chat histories: ${error.message}` });
    }
});

const startServer = (port, attemptsLeft) => {
    const serverInstance = app.listen(port);
    serverInstance.once('listening', () => {
        const address = serverInstance.address();
        const activePort = typeof address === 'object' && address ? address.port : port;
        console.log(`🚀 Server running on port ${activePort}`);
    });

    serverInstance.once('error', (error) => {
        if (error.code === 'EADDRINUSE' && attemptsLeft > 0) {
            startServer(port + 1, attemptsLeft - 1);
            return;
        }
        throw error;
    });
};

startServer(preferredPort, maxPortAttempts);
