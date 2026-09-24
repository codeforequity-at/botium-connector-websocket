const crypto = require('crypto')
const http = require('http')
const WebSocket = require('ws')

const JSON_PORT = Number(process.env.WS_JSON_PORT) || 2345
const TEXT_PORT = Number(process.env.WS_TEXT_PORT) || 2346
const REST_PORT = Number(process.env.REST_PORT) || 2347
const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini'
const SYSTEM_PROMPT = process.env.OPENAI_SYSTEM_PROMPT || 'You are a helpful assistant.'
const OPENAI_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions'
const PROMPT_CACHE_RETENTION = process.env.OPENAI_PROMPT_CACHE_RETENTION || '24h'
const LOCAL_CACHE_ENABLED = process.env.LOCAL_CACHE_ENABLED !== 'false'
const HAS_OPENAI = !!process.env.OPENAI_API_KEY

const DEFAULT_REPLIES = [
  'Hello! I am a demo bot. How can I help?',
  'Thanks for your message. What would you like to know?',
  'Interesting point! Tell me more.',
  'Got it. Anything else I can help with?'
]

const sessions = new Map()
const localResponseCache = new Map()
let defaultReplyIndex = 0

function log (dir, channel, sessionKey, data) {
  console.log(dir, '[' + channel + ']', sessionKey + ':', data)
}

function nextDefaultReply () {
  const reply = DEFAULT_REPLIES[defaultReplyIndex % DEFAULT_REPLIES.length]
  defaultReplyIndex += 1
  return reply
}

function getHistory (sessionKey) {
  if (!sessions.has(sessionKey)) {
    sessions.set(sessionKey, [{ role: 'system', content: SYSTEM_PROMPT }])
  }
  return sessions.get(sessionKey)
}

function inputMessagesForCache (messages) {
  return messages.filter((m) => m.role !== 'assistant')
}

function localCacheKey (messages) {
  return crypto.createHash('sha256').update(JSON.stringify({ model: MODEL, messages: inputMessagesForCache(messages) })).digest('hex')
}

async function askGpt (channel, sessionKey, userText) {
  const history = getHistory(sessionKey)
  history.push({ role: 'user', content: userText })
  log('->', channel, sessionKey, userText)

  if (!HAS_OPENAI) {
    const reply = nextDefaultReply()
    history.push({ role: 'assistant', content: reply })
    log('default', channel, sessionKey, reply)
    return reply
  }

  const cacheKey = localCacheKey(history)
  if (LOCAL_CACHE_ENABLED && localResponseCache.has(cacheKey)) {
    const reply = localResponseCache.get(cacheKey)
    history.push({ role: 'assistant', content: reply })
    log('cache', channel, sessionKey, reply)
    return reply
  }

  const body = {
    model: MODEL,
    messages: history,
    prompt_cache_key: sessionKey,
    prompt_cache_retention: PROMPT_CACHE_RETENTION
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + process.env.OPENAI_API_KEY
    },
    body: JSON.stringify(body)
  })

  const result = await response.json()
  if (!response.ok) {
    history.pop()
    throw new Error(result.error && result.error.message ? result.error.message : response.statusText)
  }

  const reply = result.choices[0].message.content || ''
  history.push({ role: 'assistant', content: reply })

  if (LOCAL_CACHE_ENABLED) {
    localResponseCache.set(cacheKey, reply)
  }

  const cachedTokens = result.usage &&
    result.usage.prompt_tokens_details &&
    result.usage.prompt_tokens_details.cached_tokens
  if (cachedTokens) {
    log('gpt-cache', channel, sessionKey, cachedTokens + ' prompt tokens from OpenAI cache')
  }

  log('<-', channel, sessionKey, reply)
  return reply
}

function dropSession (sessionKey) {
  sessions.delete(sessionKey)
}

function sendJson (res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  })
  res.end(body)
}

function readJsonBody (req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString()
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (err) {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

const wssJson = new WebSocket.Server({ port: JSON_PORT })
const wssText = new WebSocket.Server({ port: TEXT_PORT })

wssJson.on('connection', (ws) => {
  const sessionKey = 'new'
  log('>>', 'json', sessionKey, 'connection established')
  const welcome = {
    conversationId: 'none',
    text: 'Welcome! Send JSON with conversationId and text.'
  }
  log('>>', 'json', sessionKey, JSON.stringify(welcome))
  ws.send(JSON.stringify(welcome))

  ws.on('message', async (message) => {
    const raw = message.toString()
    log('<<', 'json', sessionKey, raw)
    let content
    try {
      content = JSON.parse(raw)
    } catch (err) {
      const invalid = { conversationId: 'none', text: 'Invalid JSON' }
      log('>>', 'json', sessionKey, JSON.stringify(invalid))
      ws.send(JSON.stringify(invalid))
      return
    }

    const key = content.conversationId || 'json-' + Math.random().toString(36).slice(2)
    const userText = content.text || ''

    if (userText === 'empty') {
      const empty = {
        conversationId: key,
        text: '',
        intent: 'EMPTY_INTENT'
      }
      log('>>', 'json', key, JSON.stringify(empty))
      ws.send(JSON.stringify(empty))
      return
    }

    try {
      const reply = await askGpt('json', key, userText)
      const out = { conversationId: key, text: reply }
      log('>>', 'json', key, JSON.stringify(out))
      ws.send(JSON.stringify(out))
    } catch (err) {
      console.error('openai error:', err.message)
      const errOut = { conversationId: key, text: 'Error: ' + err.message }
      log('>>', 'json', key, JSON.stringify(errOut))
      ws.send(JSON.stringify(errOut))
    }
  })
})

wssText.on('connection', (ws) => {
  const sessionKey = 'text-' + Math.random().toString(36).slice(2)
  log('>>', 'text', sessionKey, 'connection established')
  log('>>', 'text', sessionKey, 'Welcome!')
  ws.send('Welcome!')

  ws.on('message', async (message) => {
    const userText = message.toString()
    log('<<', 'text', sessionKey, userText)

    if (userText === 'empty') {
      log('>>', 'text', sessionKey, '')
      ws.send('')
      return
    }

    try {
      const reply = await askGpt('text', sessionKey, userText)
      log('>>', 'text', sessionKey, reply)
      ws.send(reply)
    } catch (err) {
      console.error('openai error:', err.message)
      const errOut = 'Error: ' + err.message
      log('>>', 'text', sessionKey, errOut)
      ws.send(errOut)
    }
  })

  ws.on('close', () => dropSession(sessionKey))
})

const restServer = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    sendJson(res, 200, {
      ok: true,
      mode: HAS_OPENAI ? 'openai' : 'default',
      endpoints: {
        websocketJson: `ws://127.0.0.1:${JSON_PORT}`,
        websocketText: `ws://127.0.0.1:${TEXT_PORT}`,
        restMessage: `http://127.0.0.1:${REST_PORT}/message`
      }
    })
    return
  }

  if (req.method === 'POST' && req.url === '/message') {
    let content
    try {
      content = await readJsonBody(req)
    } catch (err) {
      sendJson(res, 400, { error: err.message })
      return
    }

    const key = content.conversationId || 'rest-' + Math.random().toString(36).slice(2)
    const userText = content.text || ''
    log('<<', 'rest', key, JSON.stringify(content))

    if (userText === 'empty') {
      const empty = {
        conversationId: key,
        text: '',
        intent: 'EMPTY_INTENT'
      }
      log('>>', 'rest', key, JSON.stringify(empty))
      sendJson(res, 200, empty)
      return
    }

    try {
      const reply = await askGpt('rest', key, userText)
      const out = { conversationId: key, text: reply }
      log('>>', 'rest', key, JSON.stringify(out))
      sendJson(res, 200, out)
    } catch (err) {
      console.error('openai error:', err.message)
      sendJson(res, 500, { conversationId: key, text: 'Error: ' + err.message })
    }
    return
  }

  sendJson(res, 404, { error: 'Not found. Use GET /health or POST /message' })
})

restServer.listen(REST_PORT)

console.log(`Waiting for connections on ws://127.0.0.1:${JSON_PORT} (JSON), ws://127.0.0.1:${TEXT_PORT} (text), http://127.0.0.1:${REST_PORT} (REST)`)
if (HAS_OPENAI) {
  console.log(`Mode: openai, model: ${MODEL}, OpenAI prompt cache: ${PROMPT_CACHE_RETENTION}, local cache: ${LOCAL_CACHE_ENABLED}`)
} else {
  console.log(`Mode: default (no OPENAI_API_KEY), alternating ${DEFAULT_REPLIES.length} canned replies`)
}
