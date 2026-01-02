# ChatGPT Clone with Mnexium Memory

A ChatGPT-like interface demonstrating **Mnexium's memory and chat history APIs**. This example shows how to build AI applications with persistent memory and conversation history using Mnexium as your memory layer.

## What This Example Demonstrates

- **Persistent Memory** — AI remembers facts about users across sessions
- **Chat History** — Full conversation history stored and retrievable via API
- **Memory Recall** — Relevant memories are automatically injected into AI context
- **Memory Learning** — AI extracts and stores important information from conversations

## Prerequisites

- Node.js 18+
- A [Mnexium](https://mnexium.com) account and API key
- An OpenAI API key

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set your API keys:**
   ```bash
   export MNX_KEY=your-mnexium-api-key
   export OPENAI_KEY=your-openai-api-key
   ```

   You can get your Mnexium API key from the [Projects & API Keys](https://mnexium.com/projects) page.

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open in browser:**
   Navigate to http://localhost:3000

## Project Structure

```
chatGPTClone/
├── server.js        # Main HTTP server with route handlers
├── chatApi.js       # Chat API functions (history, messages, completions)
├── memoriesApi.js   # Memories API functions (list, search, CRUD)
├── index.html       # Chat interface
├── memories.html    # Memory viewer page
├── app.js           # Frontend chat logic
└── styles.css       # Dark theme styling
```

## Key Features

### Chat with Memory
The chat interface automatically:
- Logs all messages to Mnexium's chat history
- Recalls relevant memories for context
- Learns new facts from the conversation
- Prepends conversation history for continuity

### View User Memories
Navigate to `/u/{subject_id}/memories` to see all memories stored for a user. This demonstrates the Memories API for listing and searching stored facts.

### Chat History Management
- View past conversations in the sidebar
- Load previous chat messages
- Delete chat history via the API

## API Endpoints (Local Server)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chat` | POST | Send a message and get AI response |
| `/history/list` | GET | List all chats for a subject |
| `/history/read` | GET | Get messages for a specific chat |
| `/history/delete` | DELETE | Delete a chat |
| `/memories/list` | GET | List memories for a subject |
| `/memories/search` | GET | Search memories by query |

## Mnexium APIs Used

This example uses the following Mnexium v1 APIs:

- `POST /api/v1/responses` — Chat completion with memory features
- `GET /api/v1/chat/history/list` — List chat summaries
- `GET /api/v1/chat/history/read` — Read chat messages
- `DELETE /api/v1/chat/history/delete` — Delete chat history
- `GET /api/v1/memories` — List memories for a subject

## Configuration

The `mnx` object in chat requests controls memory behavior:

```javascript
{
  model: 'gpt-4o-mini',
  input: 'Hello!',
  mnx: {
    subject_id: 'user-123',      // The user
    chat_id: 'chat-uuid',        // The conversation
    log: true,                   // Log messages to history
    learn: true,                 // Extract and store memories
    recall: true,                // Inject relevant memories
    history: true                // Prepend conversation history
  }
}
```

> 💡 **Rule of thumb:** `subject_id` = the user, `chat_id` = the conversation.

## Learn More

📖 **[Read the full tutorial](https://mnexium.com/blogs/hello-mnexium)** — Step-by-step guide to building this example

- [Mnexium Documentation](https://mnexium.com/docs)
- [API Reference](https://mnexium.com/docs#concepts)
