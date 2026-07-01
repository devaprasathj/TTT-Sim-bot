// Select DOM elements
const chatBody = document.querySelector(".chat-body");
const messageInput = document.querySelector(".message-input");
const sendMessageButton = document.querySelector("#send-message");
const fileInput = document.querySelector("#file-input");
const fileUploadButton = document.querySelector("#file-upload");
const fileuploadWrapper = document.querySelector(".file-upload-wrapper");
const filePreviewThumbnail = document.querySelector("#file-preview-thumbnail");
const fileCancelButton = document.querySelector("#file-cancel");

// Emoji picker elements
const emojiButton = document.querySelector("#emoji-button");
const emojiPicker = document.querySelector(".emoji-picker");

// Menu elements
const menuButton = document.querySelector("#menu-button");
const dropdownMenu = document.querySelector(".dropdown-menu");
const newChatMenuItem = document.querySelector("#new-chat-menu-item");
const recentChatsMenuItem = document.querySelector("#recent-chats-menu-item");
const clearChatMenuItem = document.querySelector("#clear-chat-menu-item");
const saveChatMenuItem = document.querySelector("#save-chat-menu-item");
const modeToggleButton = document.querySelector("#mode-toggle");
const chatLauncherButton = document.querySelector("#chat-launcher");
const collapseChatButton = document.querySelector("#collapse-chat");
const chatbotPopup = document.querySelector(".chatbot-popup");


// --- API URLs ---
const BACKEND_PORTS = [3000, 3001, 3002, 3003, 3004, 3005];
const BACKEND_HOST = "http://localhost";
let resolvedBackendBaseUrl = null;

const getBackendBaseUrl = async () => {
    if (resolvedBackendBaseUrl) {
        return resolvedBackendBaseUrl;
    }

    for (const port of BACKEND_PORTS) {
        try {
            const response = await fetch(`${BACKEND_HOST}:${port}/`);
            if (response.ok) {
                resolvedBackendBaseUrl = `${BACKEND_HOST}:${port}`;
                return resolvedBackendBaseUrl;
            }
        } catch (error) {
            // Try the next port.
        }
    }

    throw new Error("Backend server not found. Start the backend in the backend folder first.");
};

const fetchBackend = async (path, options = {}) => {
    const baseUrl = await getBackendBaseUrl();
    return fetch(`${baseUrl}${path}`, options);
};

const THEME_STORAGE_KEY = "chatbot-theme";

const applyTheme = (theme) => {
    const isDark = theme === "dark";
    document.body.classList.toggle("dark-mode", isDark);
    if (modeToggleButton) {
        modeToggleButton.textContent = isDark ? "dark_mode" : "light_mode";
        modeToggleButton.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
        modeToggleButton.setAttribute("title", isDark ? "Switch to light mode" : "Switch to dark mode");
    }
};

const getInitialTheme = () => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "dark" || savedTheme === "light") {
        return savedTheme;
    }

    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? "dark"
        : "light";
};

const toggleTheme = () => {
    const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
};

const setChatOpen = (isOpen) => {
    if (!chatbotPopup || !chatLauncherButton) {
        return;
    }

    chatbotPopup.classList.toggle("is-collapsed", !isOpen);
    chatLauncherButton.classList.toggle("is-hidden", isOpen);
    chatLauncherButton.classList.toggle("is-open", isOpen);
    chatLauncherButton.setAttribute("aria-label", isOpen ? "Close chat" : "Open chat");
    chatLauncherButton.setAttribute("title", isOpen ? "Close chat" : "Open chat");

    if (isOpen) {
        setTimeout(() => messageInput?.focus(), 220);
    } else {
        emojiPicker?.classList.remove("show");
        dropdownMenu?.classList.remove("show");
        menuButton?.setAttribute("aria-expanded", "false");
    }
};

const toggleChat = () => {
    if (!chatbotPopup) {
        return;
    }

    const isOpen = chatbotPopup.classList.contains("is-collapsed");
    setChatOpen(isOpen);
};


// Object to store user data (message and file) before sending to backend
const userData = {
    message: null,
    file: {
        data: null,
        mime_type: null,
    }
};

// Array to store the entire chat history for the current session
let chatHistory = [];

let thinkingMessageDiv = null; // Reference to the "thinking" message div

// SVG for the bot's avatar
const botAvatarSVG = `
    <svg class="bot-avatar" xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 1024 1024">
        <path d="M738.3 287.6H285.7c-59 0-106.8 47.8-106.8 106.8v303.1c0 59 47.8 106.8 106.8 106.8h81.5v111.1c0 .7.8 1.1 1.4.7l166.9-110.6 41.8-.8h117.4l43.6-.4c59 0 106.8-47.8 106.8-106.8V394.5c0-59-47.8-106.9-106.8-106.9zM351.7 448.2c0-29.5 23.9-53.5 53.5-53.5s53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5-53.5-23.9-53.5-53.5zm157.9 267.1c-67.8 0-123.8-47.5-132.3-109h264.6c-8.6 61.5-64.5 109-132.3 109zm110-213.7c-29.5 0-53.5-23.9-53.5-53.5s23.9-53.5 53.5-53.5 53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5zM867.2 644.5V453.1h26.5c19.4 0 35.1 15.7 35.1 35.1v121.1c0 19.4-15.7 35.1-35.1 35.1h-26.5zM95.2 609.4V488.2c0-19.4 15.7-35.1 35.1-35.1h26.5v191.3h-26.5c-19.4 0-35.1-15.7-35.1-35.1zM561.5 149.6c0 23.4-15.6 43.3-36.9 49.7v44.9h-30v-44.9c-21.4-6.5-36.9-26.3-36.9-49.7 0-28.6 23.3-51.9 51.9-51.9s51.9 23.3 51.9 51.9z"></path>
    </svg>
`;

// HTML for the "thinking" animation — typing bubble with dots beside avatar
const thinkingDotsHTML = `
    <div class="typing-bubble">
        <div class="thinking-indicator">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    </div>
`;

/**
 * Creates a new message DOM element with specified content and classes.
 * @param {string} content - The HTML content for the message.
 * @param {...string} classes - CSS classes to add to the message div.
 * @returns {HTMLDivElement} The created message div.
 */
const createMessageElement = (content, ...classes) => {
    const div = document.createElement("div");
    // Ensure the base 'message' class is always added
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
};

/**
 * Displays a message in the chat body and adds it to chatHistory.
 * @param {string} text - The text content of the message.
 * @param {string} role - The role of the message ('user', 'bot', 'monologue', 'system', 'error').
 * @param {string} [imageSrc] - Optional base64 image source for user messages.
 * @param {boolean} [temporary=false] - If true, the message will fade out and be removed after a short delay.
 */
const displayMessage = (text, role, imageSrc = null, temporary = false) => {
    if (!chatBody) {
        console.error("[displayMessage] Error: chatBody element not found. Cannot display message.");
        return null; // Return null if chatBody is not found
    }

    let messageContent = `<div class="message-text">${text}</div>`;
    if (imageSrc) {
        messageContent += `<img src="${imageSrc}" alt="User Upload" class="uploaded-image-preview">`;
    }

    const classes = []; // Start with an empty array for classes
    let avatarHtml = '';

    if (role === 'user') {
        classes.push("user-message");
    } else if (role === 'monologue') {
        classes.push("bot-message", "inner-monologue");
        avatarHtml = botAvatarSVG;
    } else if (role === 'bot') {
        classes.push("bot-message", "user-facing");
        avatarHtml = botAvatarSVG;
    } else if (role === 'system') { // For informational messages (e.g., "Saving chat...")
        classes.push("system-message");
    } else if (role === 'error') { // For error messages
        classes.push("error-message");
        avatarHtml = botAvatarSVG; // Optionally show bot avatar for errors it reports
    }

    const messageDiv = createMessageElement(
        role === 'user' || role === 'system' || role === 'error' ? messageContent : `${avatarHtml}${messageContent}`,
        ...classes
    );

    if (temporary) {
        messageDiv.classList.add('fade-out-message');
        // Remove the element from the DOM after the animation completes
        messageDiv.addEventListener('animationend', () => {
            messageDiv.remove();
        }, { once: true });
    }

    chatBody.appendChild(messageDiv);
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });

    // Add message to chat history (only store relevant data)
    // Corrected: Filter out system/error messages from history sent to the backend.
    if (role === 'user' || role === 'monologue' || role === 'bot') {
        chatHistory.push({ role: role, text: text, image: imageSrc ? imageSrc : null });
    }
    return messageDiv;
};

/**
 * Sends the user's message and/or file to the backend and handles the bot's response.
 */
const generateBotResponse = async () => {
    // Corrected: Filter chat history to only include user and bot messages for context.
    const historyForBackend = chatHistory.filter(msg => 
        msg.role === 'user' || msg.role === 'bot'
    ).map(msg => ({ 
        // Corrected: Map 'bot' role to 'model' for compatibility with some APIs like Google's
        role: msg.role === 'bot' ? 'model' : msg.role, 
        parts: [{ text: msg.text }]
    }));

    // Prepare the current user message to send
    const currentMessageForBackend = { 
        role: 'user', 
        parts: [{ text: userData.message }] 
    };

    // If there is a file, add it as a new part to the current message
    if (userData.file.data) {
        currentMessageForBackend.parts.push({
            inline_data: {
                data: userData.file.data,
                mime_type: userData.file.mime_type
            }
        });
    }

    // Corrected: Send the entire filtered chat history and the current message in the payload
    const payload = {
        history: historyForBackend,
        currentMessage: currentMessageForBackend
    };

    // If there's no message or file, log a warning and clean up
    if (!userData.message && !userData.file.data) {
        console.warn("No message or file data to send to the bot.");
        if (thinkingMessageDiv) {
            thinkingMessageDiv.remove();
            thinkingMessageDiv = null;
        }
        chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
        messageInput.focus();
        return;
    }

    const requestOptions = {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    };

    try {
        const response = await fetchBackend("/api/chat", requestOptions);
        const data = await response.json();

        if (!response.ok) {
            const backendErrorMessage = data.error || "Unknown error from backend.";
            console.error("Backend Error:", backendErrorMessage);
            throw new Error(backendErrorMessage);
        }

        // Remove the thinking message div
        if (thinkingMessageDiv) {
            thinkingMessageDiv.remove();
            thinkingMessageDiv = null;
        }

        // Build the grouped bot response container
        const botContainer = document.createElement('div');
        botContainer.classList.add('message', 'bot-message');
        botContainer.innerHTML = botAvatarSVG;

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('bot-content');

        // Thoughts section
        const thoughtsText = (data.innerMonologue || '').replace(/\*\*(.*?)\*\*/g, "$1").trim();
        if (thoughtsText) {
            const section = document.createElement('div');
            section.classList.add('bot-section', 'thoughts');
            section.innerHTML = `<div class="section-label">🧠 Thoughts:</div><div class="section-body">${thoughtsText}</div>`;
            contentDiv.appendChild(section);
        }

        // Reflection section
        const reflectionText = (data.reflection || '').replace(/\*\*(.*?)\*\*/g, "$1").trim();
        if (reflectionText) {
            const section = document.createElement('div');
            section.classList.add('bot-section', 'reflection');
            section.innerHTML = `<div class="section-label">💡 Reflection:</div><div class="section-body">${reflectionText}</div>`;
            contentDiv.appendChild(section);
        }

        // Suggestions section
        const suggestionsList = data.suggestions || [];
        if (suggestionsList.length > 0) {
            const section = document.createElement('div');
            section.classList.add('bot-section', 'suggestions');
            let html = '<div class="section-label">✨ Suggestions:</div><ul class="suggestions-list">';
            suggestionsList.forEach(s => { html += `<li>${s}</li>`; });
            html += '</ul>';
            section.innerHTML = html;
            contentDiv.appendChild(section);
        }

        // Follow-up questions
        if (data.suggestedQuestions && data.suggestedQuestions.length > 0) {
            const followupDiv = document.createElement('div');
            followupDiv.classList.add('followup-section');
            let html = '<div class="followup-label">❓ Follow-up:</div><div class="suggestion-chips">';
            data.suggestedQuestions.forEach(q => {
                html += `<button class="suggestion-chip" data-q="${encodeURIComponent(q)}">${q}</button>`;
            });
            html += '</div>';
            followupDiv.innerHTML = html;
            followupDiv.querySelectorAll('.suggestion-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    messageInput.value = decodeURIComponent(chip.dataset.q);
                    handleOutgoingMessage();
                });
            });
            contentDiv.appendChild(followupDiv);
        }

        botContainer.appendChild(contentDiv);
        chatBody.appendChild(botContainer);

        // Add to chat history
        const combinedText = [
            thoughtsText && `🧠 ${thoughtsText}`,
            reflectionText && `💡 ${reflectionText}`,
            suggestionsList.length > 0 && `✨ ${suggestionsList.join(', ')}`
        ].filter(Boolean).join('\n');
        if (combinedText) {
            chatHistory.push({ role: 'bot', text: combinedText });
        }

        chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });

    } catch (error) {
        console.error("API Error:", error);
        let displayErrorMessage = error.message || "An unknown error occurred.";

        // Remove the thinking message div
        if (thinkingMessageDiv) {
            thinkingMessageDiv.remove();
            thinkingMessageDiv = null;
        }
        // Display error using the enhanced displayMessage function
        displayMessage(`Oops! ${displayErrorMessage}`, 'error');

    } finally {
        chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
        messageInput.focus();
        messageInput.style.height = 'auto'; // Reset textarea height

        userData.message = null;
        userData.file = { data: null, mime_type: null };
        fileuploadWrapper.classList.remove("file-uploaded");
        filePreviewThumbnail.src = "";
    }
};

/**
 * Reads a File object and returns its content as a Base64 encoded string.
 * This function is used when a file is selected from the file input.
 * @param {File} file - The File object to read.
 * @returns {Promise<string>} A promise that resolves with the Base64 string (without the data URL prefix).
 */
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}


/**
 * Handles the outgoing message from the user (either by typing or sending a file).
 * @param {Event} [e] - The event object (e.g., from keydown or click).
 */
const handleOutgoingMessage = (e) => {
    if (e) e.preventDefault();

    const userMessageTrimmed = messageInput.value.trim();
    const hasFile = userData.file.data;

    if (!userMessageTrimmed && !hasFile) {
        return;
    }

    userData.message = userMessageTrimmed;
    messageInput.value = "";
    messageInput.style.height = 'auto'; // Reset textarea height after sending

    // Display user message and add to history
    displayMessage(userData.message || '', 'user', hasFile ? `data:${userData.file.mime_type};base64,${userData.file.data}` : null);

    // Show "thinking" message after a short delay
    setTimeout(() => {
        thinkingMessageDiv = document.createElement('div');
        thinkingMessageDiv.classList.add('message', 'bot-message', 'thinking');
        thinkingMessageDiv.innerHTML = `${botAvatarSVG}${thinkingDotsHTML}`;
        chatBody.appendChild(thinkingMessageDiv);
        chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });

        generateBotResponse();
    }, 600);
};

/**
 * Auto-resizes the textarea based on its content.
 */
const autoResizeTextarea = () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
};

/**
 * Clears the chat history from the display and the local array.
 */
const clearChat = () => {
    chatBody.innerHTML = ''; // Clear messages from display
    chatHistory = []; // Clear local chat history array
    messageInput.focus();
    messageInput.style.height = 'auto'; // Reset textarea height
    console.log("Chat history cleared.");
    // Display an initial welcome message again
    displayMessage("Hey There👋 <br/>How can I help you today?", 'bot');
    // Hide the dropdown menu after action
    dropdownMenu.classList.remove('show');
    // Ensure aria-expanded is false when menu is hidden
    menuButton.setAttribute('aria-expanded', 'false');
};

/**
 * Displays a list of recent chats in a temporary overlay.
 * This function will fetch chat summaries from the backend.
 */
const loadRecentChats = async () => {
    dropdownMenu.classList.remove('show'); // Hide the main menu
    menuButton.setAttribute('aria-expanded', 'false'); // Ensure aria-expanded is false

    // Create a temporary overlay for recent chats
    const recentChatsOverlay = document.createElement('div');
    recentChatsOverlay.classList.add('recent-chats-overlay');
    recentChatsOverlay.innerHTML = `
        <div class="recent-chats-header">
            <h3>Recent Chats</h3>
            <button id="close-recent-chats" class="material-symbols-rounded">close</button>
        </div>
        <div class="recent-chats-list">
            <p class="loading-message">Loading chats...</p>
        </div>
    `;
    document.body.appendChild(recentChatsOverlay); // Append to body, not chatBody, for full overlay

    const recentChatsList = recentChatsOverlay.querySelector('.recent-chats-list');
    const closeRecentChatsButton = recentChatsOverlay.querySelector('#close-recent-chats');

    closeRecentChatsButton.addEventListener('click', () => {
        recentChatsOverlay.remove(); // Remove the overlay when closed
    });

    try {
        const response = await fetchBackend("/api/load-chats");
        const data = await response.json();

        if (response.ok) {
            recentChatsList.innerHTML = ''; // Clear loading message

            if (data.chats && data.chats.length > 0) {
                data.chats.forEach(chat => {
                    const chatItem = document.createElement('button');
                    chatItem.classList.add('chat-item');
                    chatItem.innerHTML = `
                        <div class="chat-item-info">
                            <span class="chat-item-timestamp">${chat.timestamp}</span>
                            <span class="chat-item-preview">${chat.preview}</span>
                        </div>
                        <div class="chat-item-actions">
                            <span class="material-symbols-rounded load-chat-icon" data-chat-id="${chat.id}">download</span>
                            <span class="material-symbols-rounded delete-chat-icon" data-chat-id="${chat.id}">delete</span>
                        </div>
                    `;
                    // Add event listener to load the specific chat
                    chatItem.querySelector('.load-chat-icon').addEventListener('click', (e) => {
                        e.stopPropagation();
                        loadSelectedChat(chat.id);
                        recentChatsOverlay.remove();
                    });
                    // Add event listener to delete the specific chat
                    chatItem.querySelector('.delete-chat-icon').addEventListener('click', (e) => {
                        e.stopPropagation();
                        // Show a confirmation dialog before deleting
                        showConfirmDialog('Are you sure you want to delete this chat?', () => {
                            deleteSelectedChat(chat.id);
                            recentChatsOverlay.remove();
                        });
                    });
                    recentChatsList.appendChild(chatItem);
                });
            } else {
                recentChatsList.innerHTML = '<p class="no-chats-message">No recent chats found.</p>';
            }
        } else {
            recentChatsList.innerHTML = `<p class="error-message">Error loading chats: ${data.error || 'Unknown error'}</p>`;
            console.error("Error loading chats:", data.error);
        }
    } catch (error) {
        recentChatsList.innerHTML = `<p class="error-message">Network error loading chats: ${error.message}</p>`;
        console.error("Network error loading chats:", error);
    }
};

/**
 * Loads a specific chat history by ID and displays it in the chat body.
 * This function now makes a real backend call.
 * @param {string} chatId - The ID of the chat to load.
 */
const loadSelectedChat = async (chatId) => {
    clearChat();
    displayMessage(`Loading chat: ${chatId}...`, 'system');

    try {
        const response = await fetchBackend(`/api/load-chat/${chatId}`);
        const data = await response.json();

        if (response.ok && data.chat) {
            chatHistory = data.chat;
            chatBody.innerHTML = '';
            chatHistory.forEach(msg => {
                displayMessage(msg.text, msg.role, msg.image);
            });
            displayMessage(`Chat "${chatId}" loaded successfully!`, 'system', null, true);
        } else {
            displayMessage(`Error loading chat ${chatId}: ${data.error || 'Chat not found'}`, 'error');
            console.error(`Error loading chat ${chatId}:`, data.error);
        }
    } catch (error) {
        displayMessage(`Network error loading chat ${chatId}: ${error.message}`, 'error');
        console.error("Network error loading specific chat:", error);
    }
};

/**
 * Deletes a specific chat history by ID from the backend (Firestore).
 * @param {string} chatId - The ID of the chat to delete.
 */
const deleteSelectedChat = async (chatId) => {
    displayMessage(`Deleting chat: ${chatId}...`, 'system', null, true);

    try {
        const response = await fetchBackend(`/api/delete-chat/${chatId}`, {
            method: 'DELETE',
        });

        const data = await response.json();

        if (response.ok) {
            displayMessage(`Chat "${chatId}" deleted successfully!`, 'system', null, true);
            console.log(`Chat ${chatId} deleted.`);
            loadRecentChats();
        } else {
            displayMessage(`Error deleting chat ${chatId}: ${data.error || 'Unknown error'}`, 'error');
            console.error(`Error deleting chat ${chatId}:`, data.error);
        }
    } catch (error) {
        displayMessage(`Network error deleting chat ${chatId}: ${error.message}`, 'error');
        console.error("Network error deleting chat:", error);
    }
};


/**
 * Saves the current chat history to the backend (Firestore).
 */
const saveChatHistory = async () => {
    if (chatHistory.length === 0) {
        displayMessage("No chat to save! Start a conversation first.", 'system', null, true);
        dropdownMenu.classList.remove('show');
        menuButton.setAttribute('aria-expanded', 'false');
        return;
    }

    displayMessage("Saving chat...", 'system', null, true);
    saveChatMenuItem.disabled = true;
    dropdownMenu.classList.remove('show');
    menuButton.setAttribute('aria-expanded', 'false');

    try {
        const response = await fetchBackend("/api/save-chat", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: chatHistory })
        });

        const data = await response.json();

        if (response.ok) {
            displayMessage(`Chat saved successfully! ID: ${data.chatId}`, 'system', null, true);
            console.log("Chat saved:", data.chatId);
        } else {
            const errorMessage = data.error || "Failed to save chat.";
            displayMessage(`Error saving chat: ${errorMessage}`, 'error', null, true);
            console.error("Error saving chat:", errorMessage);
        }
    } catch (error) {
        displayMessage(`Network error saving chat: ${error.message}`, 'error', null, true);
        console.error("Network error saving chat:", error);
    } finally {
        saveChatMenuItem.disabled = false;
    }
};

/**
 * Custom confirmation dialog (replaces alert/confirm)
 * @param {string} message - The message to display.
 * @param {function} onConfirm - Callback function if user confirms.
 */
const showConfirmDialog = (message, onConfirm) => {
    const dialogOverlay = document.createElement('div');
    dialogOverlay.classList.add('dialog-overlay');
    dialogOverlay.innerHTML = `
        <div class="dialog-box">
            <p>${message}</p>
            <div class="dialog-actions">
                <button id="dialog-cancel">Cancel</button>
                <button id="dialog-confirm">Confirm</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialogOverlay);

    const confirmButton = dialogOverlay.querySelector('#dialog-confirm');
    const cancelButton = dialogOverlay.querySelector('#dialog-cancel');

    confirmButton.addEventListener('click', () => {
        onConfirm();
        dialogOverlay.remove();
    });

    cancelButton.addEventListener('click', () => {
        dialogOverlay.remove();
    });
};


/**
 * Inserts text at the current caret position in a textarea.
 * @param {HTMLTextAreaElement} textArea - The textarea element.
 * @param {string} text - The text to insert.
 */
const insertAtCaret = (textArea, text) => {
    let cursorPosition = textArea.selectionStart;
    let textBefore = textArea.value.substring(0, cursorPosition);
    let textAfter = textArea.value.substring(textArea.selectionEnd, textArea.value.length);
    textArea.value = textBefore + text + textAfter;
    textArea.selectionStart = cursorPosition + text.length;
    textArea.selectionEnd = cursorPosition + text.length;
    textArea.focus();
};

// Array of emojis for the picker
const emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '😖', '😫', '😩', '🥺', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😢', '😭', '😪', '🤤', '😴',
    '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🫠', '🤥', '🤫', '🤭', '🤐', '😮', '😯', '😲', '🥱', '😴', '😤', '😠', '😡', '🤬',
    '🌞', '🌛', '🌝', '🌜', '🌚', '☀️', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '🌎', '🌍', '🌏', '☄️', '💫',
    '🌟', '✨', '⚡', '🔥', '💥', '💯', '🌈', '☀️', '☁️', '🌧️', '⛈️', '🌩️', '❄️', '☃️', '⛄', '🌬️', '💨', '🌪️', '🌫️', '🌊',
    '💧', '💦', '☔', '☂️', '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝',
    '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🥔', '🍠', '🥐', '🍞', '🥖', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖',
    '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🥙', '🥚', '🍳', '🍲', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫',
    '🍣', '🍙', '🍘', '🍚', '🍜', '🍝', '🍛', '🥟', '🍤', '🍥', '🍡', '🍢', '🍧', '🍨', '🍦', '🍰', '🧁', '🥧', '🍮', '🍭',
    '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🍼', '🥛', '☕', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂',
    '🥃', '🥤', '🧊', '🥄', '🍴', '🍽️', '🥢', '🥣', '🔪', '🏺', '🌍', '🌎', '🌏', '🌐', '🗺️', '🧭', '🏔️', '⛰️', '🌋', '🗻',
    '🏕️', '🏖️', '🏜️', '🏝️', '🏞️', '🏟️', '🏛️', '🏗️', '🏘️', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏬',
    '🏭', '🏯', '🏰', '💒', '🗼', '🗽', '⛪', '🕌', '🛕', '⛩️', '🛣️', '🛤️', ' BRIDGE_AT_NIGHT', '🌃', '🌆', '🌇', '🏙️', '🌉',
    '🏞️', '🏙️', '🌃', '🌅', '🌄', '🌇', '🌁', '♨️', '🎠', '🎡', '🎢', '💈', '🎪', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈',
    '🚉', '🚊', '🚌', '🚍', '🚎', '🚐', '🚑', '🚒', '🚓', '🚔', '🚕', '🚖', '🚗', '🚙', '🚚', '🚛', '🚜', '🏎️', '🏍️', '🛵',
    '🛺', '🚲', '🛴', '🛹', '🛼', '🚏', '🛣️', '🛤️', '⛽', '🚨', '🚥', '🚦', '🚧', '⚓', '⛵', '🛶', '🚤', '🛳️', '⛴️', '🛥️',
    '🚢', '✈️', '🛩️', '🛫', '🛬', '🪂', ' seats', '🚀', '🛸', '🛰️', '🚁', '🚃', '🚆', '🚇', '🚶‍♀️', '🚶', '🏃‍♀️', '🏃', '🤸‍♀️', '🤸',
    '⛹️‍♀️', '⛹️', '🤾‍♀️', '🤾', '🏋️‍♀️', '🏋️', '🚴‍♀️', '🚴', '🚵‍♀️', '🚵', '🧘‍♀️', '🧘', '🧖‍♀️', '🧖', '🏄‍♀️', '🏄', '🏊‍♀️', '🏊', '🤽‍♀️', '🤽',
    '🚣‍♀️', '🚣', '🐎', '🐴', '🦌', '🐄', '🐷', '🐏', '🐑', '🐐', '🐪', '🐫', '🦙', '🦒', '🐘', '🦏', '🦛', '🐭', '🐹', '🐰',
    '🐻', '🐨', '🐼', '🦊', '🐺', '🦝', '🐱', '🐈', '🦁', '🐯', '🐶', '🐕', '🦮', '🐕‍🦺', '🐅', '🐆', '🐒', '🦍', '🦧', '🦨',
    '🦥', '🦦', '🦔', '🐾', '🦅', '🦉', '🦆', '🦢', '🦩', '🕊️', '🦜', '🦚', '🦃', '🐔', '🐓', '🐣', '🐤', '🐥', '🐧', '🐢',
    '🐍', '🦎', '🦖', '🦕', '🦂', '🕷️', '🕸️', '🦗', '🐜', '🦟', '🦠', '🦀', '🦞', '🦐', '🦑', '🐙', '🐠', '🐟', '🐡', '🦈',
    '🐬', '🐳', '🐋', '🐊', '🐅', '🐆', '🦓', '🦒', '🐘', '🦏', '🐪', '🐫', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🐐',
    '🦌', '🐕', '🐩', '🐈', '🐓', '🦃', '🕊️', '🐇', '🐁', '🐀', '🐿️', '🦔', '🐉', '🐲', '🌵', '🎄', '🌲', '🌳', '🌴', '🌱',
    '🌿', '☘️', '🍀', '🎍', '🎋', '🍂', '🍁', '🍄', '🐚', '🦀', '🐠', '🐳', '🐬', '🐡', '🐙', '🌸', '🌷', '🌹', '🌺', '🌻',
    '🌼', '💐', '🌾', '🌱', '🌵', '🌴', '🌳', '🌲', '🎄', '🪵', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈',
    '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🫑', '🥒', '🥬', '🥦', '🥔', '🧅', '🧄', '🥕', '🌽', '🌶️', '🍄',
    '🌰', '🥜', '🍯', '🍞', '🥐', '🥖', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪',
    '🌮', '🌯', '🥙', '🥚', '🍳', '🍲', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱', '🍘', '🍙', '🍚', '🍜', '🍝', '🍛', '🥟',
    '🍣', '🍤', '🍥', '🍢', '🍡', '🍧', '🍨', '🍦', '🍰', '🧁', '🥧', '🍮', '🍭', '🍬', '🍫', '🍪', '🍩', '🌰', '🥜', '🥔',
    '🍠', '🍣', '🍶', '🍵', '☕', '🥛', '🍼', '🧃', '🥤', '🧋', '🥂', '🍻', '🍺', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂',
    '🥃', '🥤', '🧊', '🥄', '🍴', '🍽️', '🥢', '🥣', '🔪', '🏺', '🧭', '🗺️', '🩱', '🩲', '🩳', '👙', '👚', '👕', '👖', '👔',
    '👗', '👘', '🥻', '🩴', '🥿', '👠', '👡', '👢', '👞', '👟', '🥾', '🧦', '🧤', '🧣', '🎩', '🧢', '👒', '🎓', '⛑️', '👑',
    '💍', '💼', '👜', '🎒', '🧳', '👓', '🕶️', ' goggles', '🌂', '☔', '☂️', ' key', '🔑', '🗝️', '🔐', '🔒', '🔓', '🖊️', '🖋️',
    '✒️', '✏️', '🖍️', '🖌️', '📏', '📐', '✂️', '🪚', '🔨', '🪓', '⛏️', '🔧', '🔩', '⚙️', '⛓️', '🔗', '🪜', '🧱', '🪨', '🪵',
    '🔥', '💧', '💦', '💥', '💫', '✨', '🌟', '⭐', '🌈', '💡', '🔦', '🏮', '🪔', '🕯️', '🗑️', '🛢️', '🚿', '🛁', '🚽', '🪠',
    '🧺', '🧻', '🧼', '🪥', '🧴', '🛎️', '✉️', '📧', '📨', '📩', '📮', ' 📫', '📪', '📬', '📭', '📦', '🏷️', '🔖', '🧮', '🪝',
    '🪜', '🧱', '⚙️', '🔩', '🛠️', '🪓', '⛏️', '🔨', '🧱', '⛓️', '🔗', '🪚', '🪜', '🪝', '⚖️', '🦯', '🩼', '🩻', '🩽', '🩾',
    '🩿', '🪿', '🪷', '🪸', '🪺', '🫧', '🫙', '🫘', '🫚', '🫛', '🫜', '🫝', '🫠', '🫡', '🥹', '🫨', '🫩️', '🫪', '🫫', '🫬',
    '🫭', '🫮', '🫯', '🫰', '🫱', '🫲', '🫳', '🫴', '🫵', '🩷', '🩵', '🩶', '🫷', '🫸', '🫹', '🫺', '🫻', '🫼', '🫽', '🫾', '🫿'
];

// Function to populate the emoji picker with buttons
const renderEmojis = () => {
    emojiPicker.innerHTML = ''; // Clear previous emojis
    emojis.forEach(emoji => {
        const button = document.createElement('button');
        button.textContent = emoji;
        button.addEventListener('click', () => {
            insertAtCaret(messageInput, emoji);
            emojiPicker.classList.remove('show'); // Hide picker after selection
        });
        emojiPicker.appendChild(button);
    });
};

// Toggle emoji picker visibility
emojiButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent document click from immediately closing it
    emojiPicker.classList.toggle('show');
    if (emojiPicker.classList.contains('show')) {
        renderEmojis(); // Render emojis only when shown
    }
});

// Close emoji picker if clicking outside
document.addEventListener('click', (e) => {
    // Check if the click was outside the emoji picker and emoji button
    if (!emojiPicker.contains(e.target) && !emojiButton.contains(e.target)) {
        emojiPicker.classList.remove('show');
    }
    // Also close the dropdown menu if clicking outside
    if (!dropdownMenu.contains(e.target) && !menuButton.contains(e.target)) {
        dropdownMenu.classList.remove('show');
        menuButton.setAttribute('aria-expanded', 'false'); // Ensure aria-expanded is false
    }
});


// --- EVENT LISTENERS ---
// Send message on Enter key press (without Shift)
messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault(); // Prevent new line
        handleOutgoingMessage(e);
    }
});

// Auto-resize textarea on input
messageInput.addEventListener('input', autoResizeTextarea);

// Handle file input change (when a file is selected)
fileInput.addEventListener("change", (e) => {
    const file = fileInput.files[0];
    
    // ONLY proceed if a file is actually selected
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            // Display the image thumbnail
            filePreviewThumbnail.src = e.target.result;
            fileuploadWrapper.classList.add("file-uploaded");
            
            // Extract base64 data (without the "data:image/png;base64," prefix)
            const base64String = e.target.result.split(",")[1];
            userData.file = {
                data: base64String,
                mime_type: file.type
            };
        };
        reader.onerror = error => {
            console.error("Error reading file:", error);
            userData.file = { data: null, mime_type: null };
            fileuploadWrapper.classList.remove("file-uploaded");
            filePreviewThumbnail.src = "";
            fileInput.value = "";
            displayMessage("Error loading image. Please try again.", 'error', null, true);
        };
        reader.readAsDataURL(file);
    } else {
        // If no file is selected (e.g., user opens dialog and cancels), clear any previous selection
        userData.file = { data: null, mime_type: null };
        fileuploadWrapper.classList.remove("file-uploaded");
        filePreviewThumbnail.src = "";
        fileInput.value = "";
    }
});

// Handle file cancel button click
fileCancelButton.addEventListener("click", () => {
    userData.file = { data: null, mime_type: null };
    fileInput.value = "";
    filePreviewThumbnail.src = "";
    fileuploadWrapper.classList.remove("file-uploaded");
});

// NEW: Add event listener to the file upload button to trigger the hidden file input
fileUploadButton.addEventListener("click", () => {
    fileInput.click();
});


// Menu button toggle
menuButton.addEventListener('click', () => {
    const isExpanded = menuButton.getAttribute('aria-expanded') === 'true';
    dropdownMenu.classList.toggle('show');
    menuButton.setAttribute('aria-expanded', !isExpanded);
});

// Menu item event listeners
newChatMenuItem.addEventListener('click', clearChat);
recentChatsMenuItem.addEventListener('click', loadRecentChats);
clearChatMenuItem.addEventListener('click', () => {
    showConfirmDialog('Are you sure you want to clear the current chat?', clearChat);
});
saveChatMenuItem.addEventListener('click', saveChatHistory);

if (modeToggleButton) {
    modeToggleButton.addEventListener('click', toggleTheme);
}

if (chatLauncherButton) {
    chatLauncherButton.addEventListener('click', toggleChat);
}

if (collapseChatButton) {
    collapseChatButton.addEventListener('click', () => setChatOpen(false));
}

// Initial welcome message on page load
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getInitialTheme());
    setChatOpen(false);
    displayMessage("Hey There👋 <br/>How can I help you today?", 'bot');
});