import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Import Firebase modules
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';

// Load environment variables from .env file
dotenv.config();

const app = express();
const preferredPort = Number(process.env.PORT || 3000);
const maxPortAttempts = 10;

// --- Firebase Configuration ---
// YOUR ACTUAL FIREBASE CONFIGURATION - COPIED DIRECTLY FROM YOUR FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyDC2uQUgkoiaNrT0CCuGW8-9UqwPI1KRNk",
  authDomain: "chatbot-96752.firebaseapp.com",
  projectId: "chatbot-96752",
  storageBucket: "chatbot-96752.firebasestorage.app",
  messagingSenderId: "673546288383",
  appId: "1:673546288383:web:e049f04fbab34c90b9a0ca",
    measurementId: "G-BME1V86PQ1" // Measurement ID is for Analytics, not strictly needed for Firestore
};

// The __app_id is typically provided by the Canvas environment.
// If running locally, ensure it's set or use a default.
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
// Use gemini-1.5-flash for higher free tier limits (1500 req/min vs 20 req/min for 2.5-flash)
const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Log to confirm API key loading status
console.log(`--- Server Starting ---`);
console.log(`GEMINI_API_KEY loaded: ${!!GEMINI_API_KEY}`);
if (!GEMINI_API_KEY) {
    console.warn('WARNING: GEMINI_API_KEY is not loaded. Please check your .env file.');
}
console.log(`Using Gemini Model: ${GEMINI_MODEL}`);
console.log(`Gemini API URL: ${GEMINI_API_URL.split('?')[0]}...`);

// --- Middleware Setup ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Routes ---

// Health check endpoint
app.get('/', (req, res) => {
    res.send('✅ Chatbot backend is running.');
});

// API endpoint for chat interactions
app.post('/api/chat', async (req, res) => {
    // Extract user message from frontend's payload structure
    const userText = req.body?.currentMessage?.parts?.[0]?.text?.trim() || '';
    const fileData = req.body?.currentMessage?.parts?.[1]?.inline_data || null;

    console.log('--- New Chat Request ---');
    console.log('Received message:', userText ? `'${userText.substring(0, 50)}...'` : 'No message');
    console.log('Received file (present):', !!fileData);

    // --- System Prompt (Inner Monologue Simulator) ---
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

    // Initialize the parts array for the Gemini API request
    const parts = [{ text: systemInstruction }];

    // Add user message to parts if it exists
    if (userText) {
        parts.push({
            text: `USER_INPUT: ${userText}`
        });
        console.log('User message added to parts.');
    }

    // Add inline image data if a file is provided (existing logic for multimodal input)
    if (fileData?.data && fileData?.mime_type) {
        parts.push({
            inlineData: {
                mimeType: fileData.mime_type,
                data: fileData.data
            }
        });
        parts.push({
            text: `The user has also provided an image with their input. Analyze it naturally as part of the conversation.`
        });
        console.log(`File data added to parts for Gemini. Mime type: ${fileData.mime_type}`);
    } else if (fileData) {
        console.warn('File object received but missing data or mime_type:', fileData);
    }

    // Build contents array: history + current message
    const chatHistory = req.body.history || [];
    const contents = [
        ...chatHistory,
        { role: 'user', parts: parts }
    ];

    // Construct the request body for the Gemini API
    const requestBody = {
        contents: contents
    };

    console.log('Request body sent to Gemini:', JSON.stringify(requestBody, null, 2));

    // Retry logic with exponential backoff for rate limits
    const MAX_RETRIES = 3;
    const BASE_DELAY = 1000; // 1 second

    async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await fetch(url, options);
                const data = await response.json();

                console.log('Gemini API Response Status:', response.status);
                console.log('Gemini API Raw Data:', JSON.stringify(data, null, 2));

                if (!response.ok) {
                    const rawErrorMessage = data?.error?.message || 'Unknown error from Gemini API.';
                    const normalizedMessage = String(rawErrorMessage).toLowerCase();
                    let safeErrorMessage = rawErrorMessage;

                    if (normalizedMessage.includes('leaked') || normalizedMessage.includes('api key not valid')) {
                        safeErrorMessage = 'Gemini API key is invalid or disabled. Update GEMINI_API_KEY in backend/.env and restart backend server.';
                    }

                    // Handle rate limit (429) with retry
                    if (response.status === 429 && attempt < retries) {
                        const delay = BASE_DELAY * Math.pow(2, attempt); // Exponential backoff
                        console.warn(`Rate limited (429). Retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue; // Retry
                    }

                    console.error('Gemini API Error:', rawErrorMessage);
                    return { error: safeErrorMessage, status: response.status };
                }

                return { data, status: response.status };
            } catch (err) {
                if (attempt < retries) {
                    const delay = BASE_DELAY * Math.pow(2, attempt);
                    console.warn(`Network error, retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`, err.message);
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
                // Extract Inner Thoughts
                let rawThoughts = rawReply.substring(innerThoughtsStart + innerThoughtsMarker.length, reflectionStart).trim();
                innerMonologue = rawThoughts.replace(/\n+/g, ' ').trim();

                // Suggestions is optional — check if it exists between Reflection and Follow-up
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

                // Extract Follow-up Questions (bullet format: • question)
                let rawFollowUp = rawReply.substring(followUpStart + followUpMarker.length).trim();
                suggestedQuestions = rawFollowUp
                    .split('\n')
                    .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
                    .filter(q => q.length > 0)
                    .slice(0, 2);
            } else if (innerThoughtsStart !== -1 && reflectionStart !== -1) {
                // Partial fallback
                let rawThoughts = rawReply.substring(innerThoughtsStart + innerThoughtsMarker.length, reflectionStart).trim();
                innerMonologue = rawThoughts.replace(/\n+/g, ' ').trim();

                let rawReflection = rawReply.substring(reflectionStart + reflectionMarker.length).trim();
                userFacingResponse = rawReflection.replace(/\n+/g, ' ').trim();
            } else {
                userFacingResponse = rawReply;
                console.warn('AI did not follow Inner Monologue Simulator format. Sending raw reply.');
            }
        }

        // --- Post-Processing Truncation Limits ---
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
        console.log('Structured response (thoughts, reflection, suggestions, questions) sent to client.');

    } catch (err) {
        console.error('❌ Server error during Gemini API call:', err);
        res.status(500).json({ error: `Internal server error: ${err.message}` });
    } finally {
        console.log('--- End Chat Request ---');
    }
});

// API endpoint for saving chat history
app.post('/api/save-chat', async (req, res) => {
    const { history } = req.body;

    console.log('--- Save Chat Request ---'); // Debug log
    console.log('Received history length:', history ? history.length : 'none'); // Debug log

    if (!history || !Array.isArray(history) || history.length === 0) {
        console.warn('Attempted to save empty or invalid chat history.'); // Debug log
        return res.status(400).json({ error: 'No chat history provided to save.' });
    }

    // Check if Firebase services were initialized before attempting to use them
    if (!db) {
        console.error('Firebase Firestore not initialized. Cannot save chat.'); // Debug log
        return res.status(500).json({ error: 'Firebase services not ready. Please check server logs.' });
    }

    if (!currentUserId) {
        console.error('Attempted to save chat without a valid Firebase user ID. currentUserId is null.'); // Debug log
        return res.status(500).json({ error: 'Authentication not ready. Please try again.' });
    }

    try {
        const chatCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/chat_histories`);
        console.log('Firestore collection path:', `artifacts/${appId}/users/${currentUserId}/chat_histories`); // Debug log

        const docRef = await addDoc(chatCollectionRef, {
            userId: currentUserId,
            timestamp: new Date(),
            chat: history // Save the array of messages
        });

        console.log('Chat history saved to Firestore with ID:', docRef.id);
        res.status(200).json({ message: 'Chat history saved successfully!', chatId: docRef.id });

    } catch (error) {
        console.error('❌ Error saving chat history to Firestore:', error); // This is crucial for debugging!
        res.status(500).json({ error: `Failed to save chat history: ${error.message}` });
    } finally {
        console.log('--- End Save Chat Request ---'); // Debug log
    }
});

// API endpoint for loading chat histories
app.get('/api/load-chats', async (req, res) => {
    console.log('--- Load Chats Request ---');

    // Check if Firebase services were initialized before attempting to use them
    if (!db) {
        console.error('Firebase Firestore not initialized. Cannot load chats.');
        return res.status(500).json({ error: 'Firebase services not ready. Please check server logs.' });
    }

    if (!currentUserId) {
        console.error('Attempted to load chats without a valid Firebase user ID. currentUserId is null.');
        return res.status(500).json({ error: 'Authentication not ready. Please try again.' });
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

        // Sort chats by timestamp in descending order (most recent first)
        chats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        console.log(`Found ${chats.length} chat histories for user ${currentUserId}.`);
        res.status(200).json({ chats: chats });

    } catch (error) {
        console.error('❌ Error loading chat histories from Firestore:', error);
        res.status(500).json({ error: `Failed to load chat histories: ${error.message}` });
    } finally {
        console.log('--- End Load Chats Request ---');
    }
});


// --- Start the Server ---
const startServer = (port, attemptsLeft) => {
    const serverInstance = app.listen(port);

    serverInstance.once('listening', () => {
        const address = serverInstance.address();
        const activePort = typeof address === 'object' && address ? address.port : port;
        console.log(`🚀 Server is listening on http://localhost:${activePort}`);
        console.log(`Access the backend at: http://localhost:${activePort}`);
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
