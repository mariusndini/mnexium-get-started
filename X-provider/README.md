# Mnexium Provider Tests

Test suite demonstrating **cross-provider memory sharing** - Mnexium's killer feature.

**Learn a fact with OpenAI, recall it with Claude or Gemini.** No other platform does this.

## What is Mnexium?

Mnexium is a memory layer for LLMs. It sits between your app and the AI providers, automatically:

- **Extracting memories** from conversations (facts, preferences, context)
- **Storing them** persistently per user (`subject_id`)
- **Injecting relevant memories** into future conversations
- **Sharing memories across providers** - learn with GPT, recall with Claude

## Why Cross-Provider Memory?

Different models excel at different tasks:

| Model | Best For |
|-------|----------|
| **GPT-4o** | Complex reasoning, code generation |
| **Claude** | Long-form writing, analysis, safety |
| **Gemini** | Speed, multimodal, cost efficiency |

With Mnexium, you can use the **best model for each task** while maintaining consistent user context. Your user tells GPT-4 their preferences, and Claude already knows them.

## Quick Start

### 1. Install Dependencies

```bash
npm install openai @anthropic-ai/sdk @google/genai dotenv
```

### 2. Configure Environment

Create a `.env.local` file:

```env
# Mnexium API Key (required)
MNX_KEY=mnx_live_your_key_here

# Provider API Keys
OPENAI_KEY=sk-...
CLAUDE_API_KEY=sk-ant-...
GEMINI_KEY=...

# Mnexium Base URL
MNX_BASE_URL=https://mnexium.com/api/v1
```

### 3. Run Tests

```bash
# Run all tests
node run-all.js

# Or run individual tests
node openai.test.js
node claude.test.js
node gemini.test.js
node cross-provider.test.js
```

## Test Files

| File | Description |
|------|-------------|
| `openai.test.js` | OpenAI with native `openai` SDK |
| `claude.test.js` | Claude with native `@anthropic-ai/sdk` |
| `gemini.test.js` | Gemini with native `@google/genai` SDK |
| `cross-provider.test.js` | **Memory sharing across all providers** |
| `run-all.js` | Runs all tests |

## The Killer Feature: Cross-Provider Memory

```javascript
// 1. Learn with OpenAI
await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "My favorite color is blue" }],
  mnx: { subject_id: "user_123", learn: "force" },
});

// 2. Recall with Claude - it knows!
const res = await fetch("https://mnexium.com/api/v1/chat/completions", {
  headers: {
    "Authorization": `Bearer ${MNX_KEY}`,
    "x-anthropic-key": CLAUDE_KEY,
  },
  body: JSON.stringify({
    model: "claude-3-haiku-20240307",
    messages: [{ role: "user", content: "What's my favorite color?" }],
    mnx: { subject_id: "user_123", recall: true },
  }),
});
// Claude responds: "Your favorite color is blue!"
```

**Why this matters:**
- Use GPT-4 for complex reasoning, Claude for writing, Gemini for speed
- User context follows them across all models
- No need to re-teach each model about the user

## Native SDK Setup

Each provider's native SDK works with Mnexium. Just change the base URL:

### OpenAI
```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: MNX_KEY,
  baseURL: "https://mnexium.com/api/v1",
  defaultHeaders: { "x-openai-key": OPENAI_KEY },
});
```

### Claude (Anthropic)
```javascript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: CLAUDE_KEY,
  baseURL: "https://mnexium.com/api",  // SDK adds /v1/messages
  defaultHeaders: { "Authorization": `Bearer ${MNX_KEY}` },
});
```

### Gemini (Google)
```javascript
import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({
  apiKey: GEMINI_KEY,
  httpOptions: {
    baseUrl: "https://mnexium.com",  // SDK adds /v1beta/models/...
    headers: { "Authorization": `Bearer ${MNX_KEY}` },
  },
});
```

## The `mnx` Object

Control Mnexium features in your request:

| Parameter | Type | Description |
|-----------|------|-------------|
| `subject_id` | string | User identifier for memory/history |
| `chat_id` | string | Conversation identifier (UUID) |
| `log` | boolean | Save to chat history (default: true) |
| `learn` | boolean \| "force" | Extract memories from conversation |
| `recall` | boolean | Inject relevant memories into context |
| `history` | boolean | Include previous messages from chat_id |

## Supported Models

**OpenAI:** `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `o1`, `o1-mini`

**Claude:** `claude-3-opus-*`, `claude-3-sonnet-*`, `claude-3-haiku-*`, `claude-3-5-sonnet-*`

**Gemini:** `gemini-2.0-flash-lite`, `gemini-2.5-flash`, `gemini-1.5-pro`, `gemini-1.5-flash`

## Troubleshooting

**"MNX_KEY is not set"** - Check your `.env.local` file

**Memory recall not working:**
- Use the same `subject_id` for learn and recall
- Wait 3-5 seconds after learning for extraction
- Use `learn: "force"` to guarantee memory creation

## Real-World Use Cases

### 1. Multi-Model Chat Application
```javascript
// User chats with GPT-4 for coding help
await gpt4.chat({ message: "I'm building a React app with TypeScript" });

// Later, user asks Claude for writing help - Claude already knows the context
await claude.chat({ message: "Write documentation for my project" });
// Claude knows it's a React + TypeScript project!
```

### 2. Cost Optimization
```javascript
// Use cheap model for simple queries
const simple = await geminiFlashLite.chat({ message: "What time is it in Tokyo?" });

// Use powerful model for complex reasoning - it has all the context
const complex = await gpt4.chat({ message: "Based on our conversation, what should I prioritize?" });
```

### 3. Specialized Agents
```javascript
// Research agent uses Claude (great at analysis)
await claudeAgent.chat({ message: "Research the latest AI papers" });

// Coding agent uses GPT-4 (great at code) - knows what was researched
await gpt4Agent.chat({ message: "Implement the algorithm from the paper" });
```

## How Memory Works

1. **User sends message** → Mnexium forwards to provider
2. **Provider responds** → Mnexium analyzes for memorable facts
3. **Facts extracted** → Stored with `subject_id` in vector database
4. **Future requests with `recall: true`** → Relevant memories injected into context

```
User: "I'm allergic to peanuts"
       ↓
Mnexium extracts: { fact: "User has peanut allergy", subject_id: "user_123" }
       ↓
Later: "What should I avoid eating?"
       ↓
Mnexium injects memory → Model responds with peanut allergy context
```

## Get Your API Key

1. Sign up at [mnexium.com](https://mnexium.com)
2. Go to API Keys in the dashboard
3. Create a new key with `chat:write` scope
4. Add it to your `.env.local` as `MNX_KEY`

## Links

- **Documentation**: [docs.mnexium.com](https://docs.mnexium.com)
- **Dashboard**: [mnexium.com/dashboard](https://mnexium.com/dashboard)
- **GitHub**: [github.com/mariusndini/mnexium-get-started](https://github.com/mariusndini/mnexium-get-started)
