const API_URL = 'http://localhost:3000';

// Get subject ID and chat ID from URL
const SUBJECT_ID = window.location.pathname.split('/u/')[1]?.split('?')[0] || null;
const urlParams = new URLSearchParams(window.location.search);
let currentChatIdFromUrl = urlParams.get('chat_id') || null;

let chats = [];
let currentChatId = currentChatIdFromUrl;

const messagesEl = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistoryEl = document.getElementById('chatHistory');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadChats();
    setupEventListeners();
    
    // Set memories link href dynamically
    const memoriesLink = document.getElementById('memoriesLink');
    if (memoriesLink && SUBJECT_ID) {
        memoriesLink.href = `/u/${SUBJECT_ID}/memories`;
    }
});

function setupEventListeners() {
    sendBtn.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
    });

    newChatBtn.addEventListener('click', createNewChat);
}

async function loadChats() {
    if (!SUBJECT_ID) return;
    
    // Clear any old localStorage data
    try { localStorage.removeItem('chatGPTClone_chats'); } catch {}
    
    // Reset chats array
    chats = [];
    currentChatId = null;
    renderChatHistory();
    
    try {
        console.log('Loading chats for subject_id:', SUBJECT_ID);
        const response = await fetch(`${API_URL}/history/list?subject_id=${SUBJECT_ID}`);
        const data = await response.json();
        console.log('API returned:', data);
        
        // Convert history to chat format for sidebar
        if (data.chats && data.chats.length > 0) {
            chats = data.chats.map(chat => ({
                id: chat.chat_id,
                title: `Chat (${chat.message_count} msgs)`,
                messages: []
            }));
        }
        renderChatHistory();
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

function saveChats() {
    // No-op - history is managed by Mnexium
}

function createNewChat() {
    const chat = {
        id: crypto.randomUUID(),
        title: 'New chat',
        messages: []
    };
    chats.unshift(chat);
    currentChatId = chat.id;
    updateUrlWithChatId(chat.id);
    saveChats();
    renderChatHistory();
    renderMessages();
    messageInput.focus();
}

function updateUrlWithChatId(chatId) {
    const url = new URL(window.location.href);
    url.searchParams.set('chat_id', chatId);
    window.history.replaceState({}, '', url.toString());
}

async function selectChat(chatId) {
    currentChatId = chatId;
    updateUrlWithChatId(chatId);
    renderChatHistory();
    
    // Load messages from Mnexium if not already loaded
    const chat = chats.find(c => c.id === chatId);
    if (chat && chat.messages.length === 0) {
        messagesEl.innerHTML = '<div class="text-slate-400 text-sm">Loading messages...</div>';
        try {
            const response = await fetch(`${API_URL}/history/read?chat_id=${chatId}&subject_id=${SUBJECT_ID}`);
            const data = await response.json();
            if (data.messages && data.messages.length > 0) {
                chat.messages = data.messages.map(m => ({
                    role: m.role,
                    content: m.message
                }));
            }
        } catch (error) {
            console.error('Error loading chat messages:', error);
        }
    }
    renderMessages();
}

function renderChatHistory() {
    chatHistoryEl.innerHTML = chats.map(chat => `
        <div class="chat-history-item ${chat.id === currentChatId ? 'active' : ''}" 
             onclick="selectChat('${chat.id}')">
            <span class="chat-title">${escapeHtml(chat.title)}</span>
            <button class="delete-btn" onclick="event.stopPropagation(); deleteChat('${chat.id}')" title="Delete chat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
            </button>
        </div>
    `).join('');
}

async function deleteChat(chatId) {
    
    try {
        await fetch(`${API_URL}/history/delete?chat_id=${chatId}&subject_id=${SUBJECT_ID}`, {
            method: 'DELETE'
        });
        
        // Remove from local array
        chats = chats.filter(c => c.id !== chatId);
        
        // Clear current chat if it was deleted
        if (currentChatId === chatId) {
            currentChatId = null;
            const url = new URL(window.location.href);
            url.searchParams.delete('chat_id');
            window.history.replaceState({}, '', url.toString());
            messagesEl.innerHTML = '';
        }
        
        renderChatHistory();
    } catch (error) {
        console.error('Error deleting chat:', error);
    }
}

function renderMessages() {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) {
        messagesEl.innerHTML = '';
        return;
    }

    messagesEl.innerHTML = chat.messages.map(msg => `
        <div class="message ${msg.role}">
            ${msg.role === 'assistant' ? formatMessage(msg.content) : escapeHtml(msg.content)}
        </div>
    `).join('');

    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function formatMessage(content) {
    // Simple code block detection
    return content.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
    }).replace(/\n/g, '<br>');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function sendMessage() {
    const content = messageInput.value.trim();
    if (!content) return;

    // Create new chat if none selected
    if (!currentChatId) {
        createNewChat();
    }

    const chat = chats.find(c => c.id === currentChatId);
    
    // Add user message
    chat.messages.push({ role: 'user', content });
    
    // Update title if first message
    if (chat.messages.length === 1) {
        chat.title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
    }

    messageInput.value = '';
    messageInput.style.height = 'auto';
    saveChats();
    renderChatHistory();
    renderMessages();

    // Show typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant';
    typingDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(typingDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: chat.messages, subjectId: SUBJECT_ID, chatId: currentChatId })
        });

        const data = await response.json();
        typingDiv.remove();

        chat.messages.push({ role: 'assistant', content: data.content });
        saveChats();
        renderMessages();

    } catch (error) {
        typingDiv.remove();
        console.error('Error:', error);
        chat.messages.push({ 
            role: 'assistant', 
            content: 'Error connecting to server. Make sure it is running on localhost:3000.' 
        });
        saveChats();
        renderMessages();
    }
}
