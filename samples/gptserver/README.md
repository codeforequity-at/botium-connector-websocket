# GPT / Demo Sample Server

Demo chatbot for local Botium tests. It exposes:

| Port | Env | Protocol | Purpose |
|------|-----|----------|---------|
| `2345` | `WS_JSON_PORT` | WebSocket JSON | `{ conversationId, text }` in/out |
| `2346` | `WS_TEXT_PORT` | WebSocket text | plain string in/out |
| `2347` | `REST_PORT` | HTTP REST | `POST /message` with the same JSON shape |

With `OPENAI_API_KEY` set, replies come from OpenAI. Without a key, the server cycles through a few canned default replies (no crash, useful for offline demos).

## Start the server

```bash
cd samples/gptserver
npm install
npm start
```

Optional OpenAI:

```bash
export OPENAI_API_KEY=sk-...
npm start
```

Docker:

```bash
docker compose up --build
```

Host ports: `4055` (JSON WS), `4056` (text WS), `4057` (REST).

Quick REST check:

```bash
curl -s http://127.0.0.1:2347/health
curl -s -X POST http://127.0.0.1:2347/message \
  -H 'Content-Type: application/json' \
  -d '{"conversationId":"demo","text":"hello"}'
```

---

## Botium: Websocket Connector (JSON)

Use this for `ws://127.0.0.1:2345` (or `ws://127.0.0.1:4055` with Docker).

Install the connector (`botium-connector-websocket`), then put this in `botium.json`:

```json
{
  "botium": {
    "Capabilities": {
      "PROJECTNAME": "GPT Sample Websocket JSON",
      "CONTAINERMODE": "websocket",
      "WEBSOCKET_URL": "ws://127.0.0.1:2345",
      "WEBSOCKET_REQUEST_BODY_TEMPLATE": {
        "conversationId": "{{botium.conversationId}}",
        "text": "{{msg.messageText}}"
      },
      "WEBSOCKET_RESPONSE_TEXTS_JSONPATH": "$.text",
      "WEBSOCKET_RESPONSE_HOOK": "botMsg.nlp = { intent: { name: botMsg.sourceData.intent } }"
    }
  }
}
```

Notes:

- On connect the server sends a welcome JSON message (`Welcome! Send JSON...`). Botium will treat that as the first bot message unless you ignore it in your convo.
- Sending the text `empty` returns `{ text: "", intent: "EMPTY_INTENT" }` (useful for empty-response / NLP checks).
- `WEBSOCKET_RESPONSE_HOOK` is optional; it maps the `intent` field when present.

Check with:

```bash
botium-cli emulator
```

---

## Botium: Websocket Connector (plain text)

Use this for `ws://127.0.0.1:2346` (or `ws://127.0.0.1:4056` with Docker).

```json
{
  "botium": {
    "Capabilities": {
      "PROJECTNAME": "GPT Sample Websocket Text",
      "CONTAINERMODE": "websocket",
      "WEBSOCKET_URL": "ws://127.0.0.1:2346"
    }
  }
}
```

Without `WEBSOCKET_REQUEST_BODY_TEMPLATE` / `WEBSOCKET_RESPONSE_TEXTS_JSONPATH`, the connector runs in raw/text mode: outbound `msg.messageText` as string, inbound body as bot text.

On connect the server sends `Welcome!` as the first bot message.

---

## Botium: SimpleRest Connector

Use this for `http://127.0.0.1:2347/message` (or `http://127.0.0.1:4057/message` with Docker).

SimpleRest ships with Botium Core (`CONTAINERMODE: simplerest`). Example `botium.json`:

```json
{
  "botium": {
    "Capabilities": {
      "PROJECTNAME": "GPT Sample SimpleRest",
      "CONTAINERMODE": "simplerest",
      "SIMPLEREST_URL": "http://127.0.0.1:2347/message",
      "SIMPLEREST_METHOD": "POST",
      "SIMPLEREST_HEADERS_TEMPLATE": {
        "Content-Type": "application/json"
      },
      "SIMPLEREST_BODY_TEMPLATE": {
        "conversationId": "{{botium.conversationId}}",
        "text": "{{msg.messageText}}"
      },
      "SIMPLEREST_RESPONSE_JSONPATH": "$.text",
      "SIMPLEREST_PING_URL": "http://127.0.0.1:2347/health",
      "SIMPLEREST_PING_VERB": "GET"
    }
  }
}
```

Request / response contract (same as JSON WebSocket):

```json
{ "conversationId": "...", "text": "user message" }
```

```json
{ "conversationId": "...", "text": "bot reply" }
```

Optional: keep conversation context in Botium from the response body:

```json
"SIMPLEREST_CONTEXT_JSONPATH": "$"
```

Optional NLP mapping when the bot returns `intent` (e.g. for `empty`):

```json
"SIMPLEREST_RESPONSE_HOOK": "botMsg.nlp = { intent: { name: botMsg.sourceData.intent } }"
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | _(none)_ | If unset → default alternating replies |
| `OPENAI_MODEL` | `gpt-5-mini` | Chat model |
| `OPENAI_SYSTEM_PROMPT` | `You are a helpful assistant.` | System prompt |
| `OPENAI_API_URL` | OpenAI chat completions URL | Override API base |
| `OPENAI_PROMPT_CACHE_RETENTION` | `24h` | OpenAI prompt cache retention |
| `LOCAL_CACHE_ENABLED` | `true` | Local response cache (OpenAI mode) |
| `WS_JSON_PORT` | `2345` | JSON WebSocket port |
| `WS_TEXT_PORT` | `2346` | Text WebSocket port |
| `REST_PORT` | `2347` | REST HTTP port |
