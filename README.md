# Mnexium Examples

Runnable examples demonstrating how to integrate Mnexium with LLM providers.

## What is Mnexium?

Mnexium is a **memory layer for LLMs**. It sits between your app and AI providers, automatically:

- **Extracting memories** from conversations (facts, preferences, context)
- **Storing them** persistently per user (`subject_id`)
- **Injecting relevant memories** into future conversations
- **Sharing memories across providers** - learn with GPT, recall with Claude

## Example Folders

| Folder | Description |
|--------|-------------|
| **[Generic-Tests](./Generic-Tests)** | Step-by-step examples for all Mnexium features |
| **[X-provider](./X-provider)** | Cross-provider memory sharing (OpenAI, Claude, Gemini) |
| **[chatGPTClone](./chatGPTClone)** | Full chat UI example |

## Quick Start

### 1. Get Your API Keys

- **Mnexium**: [mnexium.com/dashboard](https://www.mnexium.com/dashboard)
- **OpenAI**: [platform.openai.com](https://platform.openai.com)
- **Claude** (optional): [console.anthropic.com](https://console.anthropic.com)
- **Gemini** (optional): [aistudio.google.com](https://aistudio.google.com)

### 2. Set Environment Variables

```bash
export MNX_KEY="mnx_live_..."
export OPENAI_KEY="sk-..."
export CLAUDE_API_KEY="sk-ant-..."  # Optional
export GEMINI_KEY="..."              # Optional
```

### 3. Run Examples

```bash
# Node.js examples
cd Generic-Tests
npm install
node 1.basic_chat.js

# Cross-provider examples
cd X-provider
npm install
node run-all.js
```

## Client Setup

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.MNX_KEY,
  baseURL: "https://www.mnexium.com/api/v1",
  defaultHeaders: { "x-openai-key": process.env.OPENAI_KEY },
});
```

## The `mnx` Object

Control Mnexium features in your requests:

```javascript
const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello!" }],
  mnx: {
    subject_id: "user_123",  // Required: identifies the user
    chat_id: "uuid-here",    // Optional: conversation identifier
    log: true,               // Save to chat history (default: true)
    learn: true,             // Extract memories (default: true)
    recall: true,            // Inject relevant memories
    history: true,           // Prepend previous messages
  },
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `subject_id` | string | **Required.** User identifier for memory/history |
| `chat_id` | string | Conversation identifier (UUID) |
| `log` | boolean | Save to chat history (default: true) |
| `learn` | boolean \| "force" | Extract memories from conversation |
| `recall` | boolean | Inject relevant memories into context |
| `history` | boolean | Include previous messages from chat_id |

## Key Features

### Memory Extraction

```javascript
// Mnexium automatically extracts facts from conversations
await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "I'm a software engineer learning Rust" }],
  mnx: { subject_id: "user_123", learn: true },
});
// Memories extracted: "User is a software engineer", "User is learning Rust"
```

### Memory Recall

```javascript
// Later, memories are injected automatically
await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "What should I build this weekend?" }],
  mnx: { subject_id: "user_123", recall: true },
});
// Model knows user is a software engineer learning Rust!
```

### Cross-Provider Memory

```javascript
// Learn with OpenAI
await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "My favorite color is blue" }],
  mnx: { subject_id: "user_123", learn: "force" },
});

// Recall with Claude - it knows!
await claude.messages.create({
  model: "claude-3-haiku-20240307",
  messages: [{ role: "user", content: "What's my favorite color?" }],
  // Claude responds: "Your favorite color is blue!"
});
```

## Links

- **Documentation**: [mnexium.com/docs](https://www.mnexium.com/docs)
- **Dashboard**: [mnexium.com/dashboard](https://www.mnexium.com/dashboard)
- **GitHub**: [github.com/mariusndini/mnexium-get-started](https://github.com/mariusndini/mnexium-get-started)
