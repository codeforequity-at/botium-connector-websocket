const WebSocket = require('ws')

const wssJson = new WebSocket.Server({ port: 2345 })
const wssText = new WebSocket.Server({ port: 2346 })

wssJson.on('connection', (ws) => {
  console.log('json connection established')
  ws.send(JSON.stringify({
    conversationId: 'none',
    text: 'Welcome!'
  }))
  ws.on('message', (message) => {
    console.log('json received: %s', message)
    const content = JSON.parse(message)
    if (content.text === 'empty') {
      ws.send(JSON.stringify({
        conversationId: content.conversationId,
        text: '',
        intent: 'EMPTY_INTENT'
      }))
    } else {
      ws.send(JSON.stringify({
        conversationId: content.conversationId,
        text: 'Got your question.',
      }))
      ws.send(JSON.stringify({
        conversationId: content.conversationId,
        text: 'You said: ' + content.text,
        intent: 'SOME_INTENT'
      }))
    }
  })
})

wssText.on('connection', (ws) => {
  console.log('text connection established')
  ws.send('Welcome!')
  ws.on('message', (message) => {
    console.log('text received: %s', message)
    if (message === 'empty') {
      ws.send('')
    } else {
      ws.send('Got your question.')
      ws.send('You said: ' + message)
    }
  })
})

console.log('Waiting for connections on ws://127.0.0.1:2345 (for JSON) and ws://127.0.0.1:2346 (for text)')
