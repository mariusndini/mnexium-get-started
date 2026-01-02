/**
 * Memories API functions for Mnexium
 * 
 * This module handles all memory-related API calls:
 * - Listing memories for a subject
 * - Searching memories
 * - Creating memories
 * - Updating memories
 * - Deleting memories
 */

const MNX_KEY = process.env.MNX_KEY || '';
const BASE_URL = 'https://www.mnexium.com';

/**
 * List memories for a subject
 * GET /api/v1/memories?subject_id=...&limit=...
 */
async function listMemories(subjectId, limit = 50) {
    const fetch = (await import('node-fetch')).default;
    
    const url = `${BASE_URL}/api/v1/memories?subject_id=${encodeURIComponent(subjectId)}&limit=${limit}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${MNX_KEY}`
        }
    });

    return response.json();
}

/**
 * Search memories for a subject
 * GET /api/v1/memories/search?subject_id=...&q=...&limit=...&min_score=...
 */
async function searchMemories(subjectId, query, limit = 10, minScore = 35) {
    const fetch = (await import('node-fetch')).default;
    
    const url = `${BASE_URL}/api/v1/memories/search?subject_id=${encodeURIComponent(subjectId)}&q=${encodeURIComponent(query)}&limit=${limit}&min_score=${minScore}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${MNX_KEY}`
        }
    });

    return response.json();
}

/**
 * Get a single memory by ID
 * GET /api/v1/memories/:id
 */
async function getMemory(memoryId) {
    const fetch = (await import('node-fetch')).default;
    
    const url = `${BASE_URL}/api/v1/memories/${encodeURIComponent(memoryId)}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${MNX_KEY}`
        }
    });

    return response.json();
}

/**
 * Create a new memory
 * POST /api/v1/memories
 */
async function createMemory(subjectId, text, kind = 'fact', importance = 50) {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(`${BASE_URL}/api/v1/memories`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${MNX_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            subject_id: subjectId,
            text,
            kind,
            importance
        })
    });

    return response.json();
}

/**
 * Update a memory
 * PATCH /api/v1/memories/:id
 */
async function updateMemory(memoryId, text, kind, importance) {
    const fetch = (await import('node-fetch')).default;
    
    const body = { text };
    if (kind) body.kind = kind;
    if (importance !== undefined) body.importance = importance;

    const response = await fetch(`${BASE_URL}/api/v1/memories/${encodeURIComponent(memoryId)}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${MNX_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    return response.json();
}

/**
 * Delete a memory
 * DELETE /api/v1/memories/:id
 */
async function deleteMemory(memoryId) {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(`${BASE_URL}/api/v1/memories/${encodeURIComponent(memoryId)}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${MNX_KEY}`
        }
    });

    return response.json();
}

// HTTP response helpers for server routes
async function handleListMemories(subjectId, res) {
    try {
        const data = await listMemories(subjectId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    } catch (e) {
        console.error('List memories error:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message, memories: [] }));
    }
}

async function handleSearchMemories(subjectId, query, res) {
    try {
        const data = await searchMemories(subjectId, query);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    } catch (e) {
        console.error('Search memories error:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message, memories: [] }));
    }
}

module.exports = {
    listMemories,
    searchMemories,
    getMemory,
    createMemory,
    updateMemory,
    deleteMemory,
    handleListMemories,
    handleSearchMemories
};
