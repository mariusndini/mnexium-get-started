# Mnexium Generic Tests

Step-by-step examples demonstrating all Mnexium features with the OpenAI SDK.

## Quick Start

```bash
# Install dependencies
npm install

# Create .env.local with your keys
cp .env.local.example .env.local
# Edit .env.local with your actual keys

# Run examples
node 1.basic_chat.js
```

## Environment Variables

Create a `.env.local` file:

```env
MNX_KEY=mnx_live_your_key_here
OPENAI_KEY=sk-...
SUBJECT_ID=demo_user
```

## Examples

Run these in order to understand Mnexium's features:

| # | File | Description |
|---|------|-------------|
| 1 | `1.basic_chat.js` | Minimal setup - swap base URL, add headers |
| 2 | `2.memory_extraction.js` | Automatic memory extraction from conversations |
| 3 | `3.chat_with_history.js` | Multi-turn conversations with `history: true` |
| 4 | `4.memories_recall.js` | Inject memories into prompts with `recall: true` |
| 5 | `5.memories_crud.js` | Create, read, update, delete memories via API |
| 6 | `6.system_prompts.js` | Manage system prompts for different contexts |
| 7 | `7.responses_api.js` | OpenAI's newer Responses API format |
| 8 | `8.streaming_chat.js` | Real-time streaming responses |

### Advanced Tests

| File | Description |
|------|-------------|
| `9.full_api_test.js` | Comprehensive API test suite |
| `10.concurrency_test.js` | Concurrent request handling |
| `10.edge_case_tests.js` | Edge cases and error handling |
| `10.memory_versioning_test.js` | Memory superseding and versioning |
| `11.tool_calls_with_history.js` | Tool calling with conversation history |
| `12.tool_calls.js` | Function/tool calling examples |
| `13.agent_state_test.js` | Agent state management |
| `14.profile_extraction.mjs` | User profile extraction |
| `15.profile_api_test.js` | Profile API operations |
| `16.summarize_test.js` | Conversation summarization |
| `17.summarize_comprehensive_test.js` | Advanced summarization |
| `18.provider_test.js` | Multi-provider support |

## The `mnx` Object

Every request can include Mnexium-specific options:

```javascript
const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello!" }],
  mnx: {
    subject_id: "user_123",     // Required: identifies the user
    chat_id: "uuid-here",       // Optional: conversation identifier
    log: true,                  // Save to chat history (default: true)
    learn: true,                // Extract memories (default: true)
    recall: true,               // Inject relevant memories
    history: true,              // Prepend previous messages
  },
});
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

## Links

- [Documentation](https://www.mnexium.com/docs)
- [Dashboard](https://www.mnexium.com/dashboard)
