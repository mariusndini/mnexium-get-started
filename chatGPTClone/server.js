const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Import API modules
const { getHistoryList, getChatMessages, deleteChat, chat } = require('./chatApi');
const { handleListMemories, handleSearchMemories } = require('./memoriesApi');

const PORT = 3000;

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    
    // Redirect root to new UUID
    if (url.pathname === '/') {
        const newId = crypto.randomUUID();
        res.writeHead(302, { 'Location': `/u/${newId}` });
        res.end();
        return;
    }

    // Serve app at /u/:uuid
    const uuidMatch = url.pathname.match(/^\/u\/([a-f0-9-]+)$/);
    if (uuidMatch) {
        const filePath = path.join(__dirname, 'index.html');
        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
        });
        return;
    }

    // Serve memories page at /u/:uuid/memories
    const memoriesMatch = url.pathname.match(/^\/u\/([a-f0-9-]+)\/memories$/);
    if (memoriesMatch) {
        const filePath = path.join(__dirname, 'memories.html');
        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
        });
        return;
    }

    // Get chat history list endpoint
    if (req.method === 'GET' && url.pathname === '/history/list') {
        const subjectId = url.searchParams.get('subject_id');
        if (!subjectId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'subject_id required' }));
            return;
        }
        await getHistoryList(subjectId, res);
        return;
    }

    // Get messages for a specific chat
    if (req.method === 'GET' && url.pathname === '/history/read') {
        const chatId = url.searchParams.get('chat_id');
        const subjectId = url.searchParams.get('subject_id');
        if (!chatId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'chat_id required' }));
            return;
        }
        await getChatMessages(chatId, subjectId || '', res);
        return;
    }

    // Delete chat history
    if (req.method === 'DELETE' && url.pathname === '/history/delete') {
        const chatId = url.searchParams.get('chat_id');
        const subjectId = url.searchParams.get('subject_id');
        if (!chatId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'chat_id required' }));
            return;
        }
        await deleteChat(chatId, subjectId || '', res);
        return;
    }

    // List memories for a subject
    if (req.method === 'GET' && url.pathname === '/memories/list') {
        const subjectId = url.searchParams.get('subject_id');
        if (!subjectId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'subject_id required' }));
            return;
        }
        await handleListMemories(subjectId, res);
        return;
    }

    // Search memories for a subject
    if (req.method === 'GET' && url.pathname === '/memories/search') {
        const subjectId = url.searchParams.get('subject_id');
        const query = url.searchParams.get('q');
        if (!subjectId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'subject_id required' }));
            return;
        }
        if (!query) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'q (query) required' }));
            return;
        }
        await handleSearchMemories(subjectId, query, res);
        return;
    }

    // API endpoint - extract UUID from referer or body
    if (req.method === 'POST' && url.pathname === '/chat') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { messages, subjectId, chatId } = JSON.parse(body);
                await chat(messages, subjectId, chatId, res);
            } catch (error) {
                console.error('Error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // Serve static files (css, js)
    let filePath = url.pathname;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const mimeTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };
    const contentType = mimeTypes[ext] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Open this URL in your browser to use the ChatGPT Clone');
});
