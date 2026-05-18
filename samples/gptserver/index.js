const WebSocket = require('ws')

const JSON_PORT = Number(process.env.WS_JSON_PORT) || 2345
const TEXT_PORT = Number(process.env.WS_TEXT_PORT) || 2346
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const SYSTEM_PROMPT = process.env.OPENAI_SYSTEM_PROMPT || 'You are a helpful assistant.'
const OPENAI_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions'

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is required')
  process.exit(1)
}

const sessions = new Map()

function log (dir, channel, sessionKey, data) {
  console.log(dir, '[' + channel + ']', sessionKey + ':', data)
}

function getHistory (sessionKey) {
  if (!sessions.has(sessionKey)) {
    sessions.set(sessionKey, [{ role: 'system', content: SYSTEM_PROMPT }])
  }
  return sessions.get(sessionKey)
}

async function askGpt (channel, sessionKey, userText) {
  const history = getHistory(sessionKey)
  history.push({ role: 'user', content: userText })
  log('->', channel, sessionKey, userText)

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + process.env.OPENAI_API_KEY
    },
    body: JSON.stringify({ model: MODEL, messages: history })
  })

  const body = await response.json()
  if (!response.ok) {
    throw new Error(body.error && body.error.message ? body.error.message : response.statusText)
  }

  const reply = body.choices[0].message.content || ''
  history.push({ role: 'assistant', content: reply })
  log('<-', channel, sessionKey, reply)
  return reply
}

function dropSession (sessionKey) {
  sessions.delete(sessionKey)
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

    const key = content.conversationId || 'default'
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

console.log(`Waiting for connections on ws://127.0.0.1:${JSON_PORT} (JSON) and ws://127.0.0.1:${TEXT_PORT} (text)`)
