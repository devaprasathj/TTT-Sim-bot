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


// --- IMPORTANT: This now points to your backend proxy server ---
const BACKEND_API_URL = "http://localhost:3000/api/chat";
const SAVE_CHAT_API_URL = "http://localhost:3000/api/save-chat";
const LOAD_CHATS_API_URL = "http://localhost:3000/api/load-chats"; // Placeholder for loading recent chats

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

// HTML for the "thinking" animation dots
const thinkingDotsHTML = `
    <div class="message-text">
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
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
};

/**
 * Displays a message in the chat body and adds it to chatHistory.
 * @param {string} text - The text content of the message.
 * @param {string} role - The role of the message ('user', 'bot', 'monologue', 'system', 'error').
 * @param {string} [imageSrc] - Optional base64 image source for user messages.
 */
const displayMessage = (text, role, imageSrc = null) => {
    let messageContent = `<div class="message-text">${text}</div>`;
    if (imageSrc) {
        messageContent += `<img src="${imageSrc}" alt="User Upload" class="uploaded-image-preview">`;
    }

    const classes = ["message"];
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
        role === 'user' || role === 'system' ? messageContent : `${avatarHtml}${messageContent}`,
        ...classes
    );
    chatBody.appendChild(messageDiv);
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });

    // Add message to chat history (only store relevant data, not full base64 for images unless needed for re-display)
    // System/error messages are not typically part of the "chat history" to be saved.
    if (role === 'user' || role === 'monologue' || role === 'bot') {
        chatHistory.push({ role: role, text: text, image: imageSrc ? imageSrc : null });
    }
    return messageDiv; // Return the created div for potential removal later
};


/**
 * Sends the user's message and/or file to the backend and handles the bot's response.
 */
const generateBotResponse = async () => {
    // Prepare the payload to send to your backend
    const payload = {
        message: userData.message,
        // Only include file data if it exists
        file: userData.file.data ? userData.file : undefined
    };

    // If there's no message or file, log a warning and clean up
    if (!payload.message && !payload.file) {
        console.warn("No message or file data to send to the bot.");
        if (thinkingMessageDiv) {
            thinkingMessageDiv.remove();
            thinkingMessageDiv = null;
        }
        chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
        messageInput.focus();
        return;
    }

    // Configure the fetch request
    const requestOptions = {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload) // Convert payload to JSON string
    };

    try {
        const response = await fetch(BACKEND_API_URL, requestOptions);
        const data = await response.json();

        if (!response.ok) {
            const backendErrorMessage = data.error || "Unknown error from backend.";
            console.error("Backend Error:", backendErrorMessage);
            throw new Error(backendErrorMessage);
        }

        let innerMonologueText = data.innerMonologue || "";
        let userFacingResponseText = data.userFacingResponse || "I couldn't generate a response. Please try again.";

        // --- Frontend Cleaning for Display ---
        innerMonologueText = innerMonologueText.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\n+/g, ' ').trim();
        userFacingResponseText = userFacingResponseText.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\n+/g, ' ').trim();

        // --- Output Constraints (Post-Processing Truncation Limits) ---
        const MAX_USER_FACING_LENGTH = 450; // From server-js-with-firestore
        const MAX_MONOLOGUE_LENGTH = 300;   // From server-js-with-firestore (more concise)

        // Apply truncation to inner monologue
        if (innerMonologueText.length > MAX_MONOLOGUE_LENGTH) {
            innerMonologueText = innerMonologueText.substring(0, innerMonologueText.lastIndexOf(' ', MAX_MONOLOGUE_LENGTH)) + '...';
        }

        // Apply truncation to user-facing response
        if (userFacingResponseText.length > MAX_USER_FACING_LENGTH) {
            userFacingResponseText = userFacingResponseText.substring(0, userFacingResponseText.lastIndexOf(' ', MAX_USER_FACING_LENGTH)) + '...';
        }

        // Remove the thinking message div
        if (thinkingMessageDiv) {
            thinkingMessageDiv.remove();
            thinkingMessageDiv = null;
        }

        // --- Display Inner Monologue (only if it has content) ---
        if (innerMonologueText.length > 0) {
            displayMessage(`* Inner Monologue: ${innerMonologueText}`, 'monologue');
        }

        // --- Display User-Facing Response ---
        displayMessage(userFacingResponseText, 'bot');

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
        const messageContentForThinking = `${botAvatarSVG}${thinkingDotsHTML}`;
        thinkingMessageDiv = createMessageElement(
            messageContentForThinking,
            "bot-message",
            "thinking"
        );
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
    chatBody.appendChild(recentChatsOverlay);
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });

    const recentChatsList = recentChatsOverlay.querySelector('.recent-chats-list');
    const closeRecentChatsButton = recentChatsOverlay.querySelector('#close-recent-chats');

    closeRecentChatsButton.addEventListener('click', () => {
        recentChatsOverlay.remove(); // Remove the overlay when closed
    });

    try {
        const response = await fetch(LOAD_CHATS_API_URL);
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
                        <span class="material-symbols-rounded load-chat-icon" data-chat-id="${chat.id}">download</span>
                    `;
                    // Add event listener to load the specific chat
                    chatItem.querySelector('.load-chat-icon').addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent button click from affecting parent
                        loadSelectedChat(chat.id);
                        recentChatsOverlay.remove(); // Close overlay after selecting
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
 * This requires a new backend endpoint to fetch a single chat by ID.
 * For now, we'll simulate loading.
 * @param {string} chatId - The ID of the chat to load.
 */
const loadSelectedChat = async (chatId) => {
    clearChat(); // Clear current chat display
    displayMessage(`Loading chat: ${chatId}...`, 'system');

    // In a real application, you would fetch the full chat history from the backend
    // using a new endpoint like /api/chat/:chatId
    // For now, we'll simulate fetching and display a dummy history.
    try {
        // You would need a new backend endpoint like /api/chat/:chatId
        // const response = await fetch(`${BACKEND_API_URL}/${chatId}`);
        // const data = await response.json();
        // if (response.ok && data.chat) {
        //     chatHistory = data.chat; // Update global chatHistory
        //     chatBody.innerHTML = ''; // Clear loading message
        //     chatHistory.forEach(msg => {
        //         displayMessage(msg.text, msg.role, msg.image);
        //     });
        //     displayMessage(`Chat "${chatId}" loaded successfully!`, 'system');
        // } else {
        //     displayMessage(`Error loading chat ${chatId}: ${data.error || 'Chat not found'}`, 'error');
        // }

        // SIMULATED LOADING (REMOVE THIS BLOCK WHEN YOU IMPLEMENT BACKEND FETCH FOR SINGLE CHAT)
        setTimeout(() => {
            const simulatedChat = [
                { role: 'bot', text: 'Welcome back! This is a loaded chat.' },
                { role: 'user', text: 'Hey, I remember this conversation!' },
                { role: 'bot', text: `You loaded chat ID: ${chatId}. What would you like to discuss next?` }
            ];
            chatHistory = simulatedChat; // Update global chatHistory
            chatBody.innerHTML = ''; // Clear loading message
            simulatedChat.forEach(msg => {
                displayMessage(msg.text, msg.role, msg.image);
            });
            displayMessage(`Chat "${chatId}" loaded successfully! (Simulated)`, 'system');
        }, 1000);
        // END SIMULATED LOADING

    } catch (error) {
        displayMessage(`Network error loading chat ${chatId}: ${error.message}`, 'error');
        console.error("Network error loading specific chat:", error);
    }
};


/**
 * Saves the current chat history to the backend (Firestore).
 */
const saveChatHistory = async () => {
    if (chatHistory.length === 0) {
        displayMessage("No chat to save! Start a conversation first.", 'system'); // Use 'system' role for info
        dropdownMenu.classList.remove('show'); // Hide menu
        menuButton.setAttribute('aria-expanded', 'false'); // Ensure aria-expanded is false
        return;
    }

    // Show a temporary saving message
    const savingMessageDiv = displayMessage("Saving chat...", 'system'); // Use 'system' role
    saveChatMenuItem.disabled = true; // Disable button during save
    dropdownMenu.classList.remove('show'); // Hide menu
    menuButton.setAttribute('aria-expanded', 'false'); // Ensure aria-expanded is false

    try {
        const response = await fetch(SAVE_CHAT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: chatHistory })
        });

        const data = await response.json();

        if (response.ok) {
            // Remove the "Saving..." message, then display success
            if (savingMessageDiv && savingMessageDiv.parentNode) {
                savingMessageDiv.parentNode.removeChild(savingMessageDiv);
            }
            displayMessage(`Chat saved successfully! ID: ${data.chatId}`, 'system'); // Use 'system' role
            console.log("Chat saved:", data.chatId);
        } else {
            const errorMessage = data.error || "Failed to save chat.";
            // Remove the "Saving..." message, then display error
            if (savingMessageDiv && savingMessageDiv.parentNode) {
                savingMessageDiv.parentNode.removeChild(savingMessageDiv);
            }
            displayMessage(`Error saving chat: ${errorMessage}`, 'error'); // Use 'error' role
            console.error("Error saving chat:", errorMessage);
        }
    } catch (error) {
        // Remove the "Saving..." message, then display network error
        if (savingMessageDiv && savingMessageDiv.parentNode) {
            savingMessageDiv.parentNode.removeChild(savingMessageDiv);
        }
        displayMessage(`Network error saving chat: ${error.message}`, 'error'); // Use 'error' role
        console.error("Network error saving chat:", error);
    } finally {
        saveChatMenuItem.disabled = false; // Re-enable button
    }
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
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
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
    console.log("File input change detected. File:", file); // Debug log

    // ONLY proceed if a file is actually selected
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            // Display the image thumbnail
            filePreviewThumbnail.src = e.target.result;
            fileuploadWrapper.classList.add("file-uploaded"); // Add class ONLY when file is loaded

            // Extract base64 data (without the "data:image/png;base64," prefix)
            const base64String = e.target.result.split(",")[1];
            userData.file = {
                data: base64String,
                mime_type: file.type
            };
            console.log("File loaded and preview updated."); // Debug log
        };
        reader.onerror = error => {
            console.error("Error reading file:", error); // Debug log
            // Reset UI on error
            userData.file = { data: null, mime_type: null };
            fileuploadWrapper.classList.remove("file-uploaded");
            filePreviewThumbnail.src = "";
        };
        reader.readAsDataURL(file); // Read the file as a Data URL (base64)
    } else {
        // If user cancels file selection (e.g., opens dialog and closes without choosing)
        console.log("No file selected or selection cancelled."); // Debug log
        userData.file = { data: null, mime_type: null };
        fileuploadWrapper.classList.remove("file-uploaded");
        filePreviewThumbnail.src = "";
    }
    fileInput.value = ""; // Always clear the file input element after handling (or not handling)
});

// Handle file cancel button click
fileCancelButton.addEventListener("click", () => {
    console.log("File cancel button clicked."); // Debug log
    // Clear file data and UI
    userData.file = { data: null, mime_type: null };
    fileInput.value = ""; // Crucial for allowing re-uploading the same file
    fileuploadWrapper.classList.remove("file-uploaded");
    filePreviewThumbnail.src = "";
});

// Send message on button click
sendMessageButton.addEventListener("click", (e) => handleOutgoingMessage(e));

// Trigger file input click when file upload button is clicked
fileUploadButton.addEventListener("click", () => {
    console.log("File upload button clicked. Opening file dialog."); // Debug log
    fileInput.click();
});

// Event listener for the main menu button
menuButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent document click from immediately closing it
    const isExpanded = dropdownMenu.classList.toggle('show');
    menuButton.setAttribute('aria-expanded', isExpanded); // Toggle aria-expanded
});

// Event listeners for menu items
newChatMenuItem.addEventListener('click', clearChat);
clearChatMenuItem.addEventListener('click', clearChat); // Clear chat messages is the same as new chat in this context
saveChatMenuItem.addEventListener('click', saveChatHistory);
recentChatsMenuItem.addEventListener('click', loadRecentChats); // Attach loadRecentChats

// Initial welcome message when the page loads
document.addEventListener('DOMContentLoaded', () => {
    displayMessage("Hey There👋 <br/>How can I help you today?", 'bot');
});
