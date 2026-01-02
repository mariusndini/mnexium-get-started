/**
 * Chat API functions for Mnexium
 * 
 * This module handles all chat-related API calls:
 * - Listing chat history
 * - Reading chat messages
 * - Deleting chats
 * - Sending chat messages
 */

const MNX_KEY = process.env.MNX_KEY || '';
const OPENAI_KEY = process.env.OPENAI_KEY || '';
const BASE_URL = 'https://www.mnexium.com';

/**
 * Get list of chats for a subject
 * GET /api/v1/chat/history/list
 */
async function getHistoryList(subjectId, res) {
    const fetch = (await import('node-fetch')).default;
    
    const url = `${BASE_URL}/api/v1/chat/history/list?subject_id=${encodeURIComponent(subjectId)}&limit=50`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${MNX_KEY}`
        }
    });

    const text = await response.text();
    try {
        const data = JSON.parse(text);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    } catch (e) {
        console.log('History API response:', text.slice(0, 200));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ chats: [] }));
    }
}

/**
 * Get messages for a specific chat
 * GET /api/v1/chat/history/read
 */
async function getChatMessages(chatId, subjectId, res) {
    const fetch = (await import('node-fetch')).default;
    
    const url = `${BASE_URL}/api/v1/chat/history/read?chat_id=${encodeURIComponent(chatId)}&subject_id=${encodeURIComponent(subjectId)}&limit=200`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${MNX_KEY}`
        }
    });

    const text = await response.text();
    try {
        const data = JSON.parse(text);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    } catch (e) {
        console.log('Chat messages API response:', text.slice(0, 200));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ messages: [] }));
    }
}

/**
 * Delete a chat
 * DELETE /api/v1/chat/history/delete
 */
async function deleteChat(chatId, subjectId, res) {
    const fetch = (await import('node-fetch')).default;
    
    const url = `${BASE_URL}/api/v1/chat/history/delete?chat_id=${encodeURIComponent(chatId)}&subject_id=${encodeURIComponent(subjectId)}`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${MNX_KEY}`
        }
    });

    const text = await response.text();
    try {
        const data = JSON.parse(text);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    } catch (e) {
        console.log('Delete chat API response:', text.slice(0, 200));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
    }
}

/**
 * Send a chat message and get AI response
 * POST /api/v1/responses
 */
async function chat(messages, subjectId, chatId, res) {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(`${BASE_URL}/api/v1/responses`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${MNX_KEY}`,
            'x-openai-key': OPENAI_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            input: messages[messages.length - 1].content,
            mnx: {
                subject_id: subjectId,
                chat_id: chatId,
                log: true,
                learn: true,
                recall: true,
                history: true
            }
        })
    });

    const data = await response.json();
    const content = data.output[0].content[0].text;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ content }));
}

module.exports = {
    getHistoryList,
    getChatMessages,
    deleteChat,
    chat
};
