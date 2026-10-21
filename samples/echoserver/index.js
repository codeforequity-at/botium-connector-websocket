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
    const text = message.toString()
    console.log('json received: %s', text)
    const content = JSON.parse(text)
    if (content.text === 'empty') {
      ws.send(JSON.stringify({
        conversationId: content.conversationId,
        text: '',
        intent: 'EMPTY_INTENT'
      }))
    } else {
      ws.send(JSON.stringify({
        conversationId: content.conversationId,
        text: 'Got your question.'
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
    const text = message.toString()
    console.log('text received: %s', text)
    if (text === 'empty') {
      ws.send('')
    } else {
      ws.send('Got your question.')
      ws.send('You said: ' + text)
    }
  })
})

console.log('Waiting for connections on ws://127.0.0.1:2345 (for JSON) and ws://127.0.0.1:2346 (for text)')
