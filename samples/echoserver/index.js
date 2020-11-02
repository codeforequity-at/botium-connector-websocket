const WebSocket = require('ws')

const wss = new WebSocket.Server({ port: 2345 })

wss.on('connection', (ws) => {
  console.log('connection established')
  ws.send(JSON.stringify({
    conversationId: 'none',
    text: 'Welcome!'
  }))
  ws.on('message', (message) => {
    console.log('received: %s', message)
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

console.log('Waiting for connections on ws://127.0.0.1:2345')
