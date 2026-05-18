const WebSocket = require('ws')

const url = process.env.WS_URL || 'ws://127.0.0.1:2345'
const text = process.argv.slice(2).join(' ') || process.env.TEST_MESSAGE || 'Say hello in one short sentence.'
const conversationId = process.env.TEST_CONVERSATION_ID || 'test-client'
const timeoutMs = Number(process.env.TEST_TIMEOUT_MS) || 60000

const wsOptions = url.startsWith('wss://') ? { rejectUnauthorized: false } : undefined
const ws = new WebSocket(url, wsOptions)
let step = 0

const timer = setTimeout(() => {
  console.error('timeout after %dms', timeoutMs)
  ws.terminate()
  process.exit(1)
}, timeoutMs)

ws.on('error', (err) => {
  clearTimeout(timer)
  console.error(err.message)
  process.exit(1)
})

ws.on('message', (data) => {
  const raw = data.toString()
  console.log('<<', raw)

  if (step === 0) {
    step = 1
    const payload = url.endsWith('/2346') || url.includes(':2346')
      ? text
      : JSON.stringify({ conversationId, text })
    console.log('>>', payload)
    ws.send(payload)
    return
  }

  clearTimeout(timer)
  ws.close()
  process.exit(0)
})
