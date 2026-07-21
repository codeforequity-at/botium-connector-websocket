const BotiumConnectorWebsocket = require('./src/connector')

module.exports = {
  PluginVersion: 1,
  PluginClass: BotiumConnectorWebsocket,
  PluginDesc: {
    name: 'Websocket',
    provider: 'Websocket',
    features: {
      sendAttachments: false,
      audioInput: false
    },
    capabilities: [
      {
        name: 'WEBSOCKET_URL',
        label: 'Websocket URL',
        description: 'Websocket endpoint URL, starting with ws:// or wss://',
        type: 'url',
        required: true
      },
      {
        name: 'WEBSOCKET_HEADERS_TEMPLATE',
        label: 'HTTP Headers',
        description: 'Websocket HTTP Headers as Mustache template (JSON object)',
        type: 'json',
        required: false,
        advanced: true
      },
      {
        name: 'WEBSOCKET_HANDSHAKE_TIMEOUT',
        label: 'Handshake Timeout',
        description: 'Opening handshake timeout in milliseconds (default: 10000)',
        type: 'int',
        required: false,
        advanced: true
      },
      {
        name: 'WEBSOCKET_REJECT_UNAUTHORIZED',
        label: 'Reject Unauthorized',
        description: 'TLS certificate validation for wss:// connections. Set to false to accept self-signed or invalid certificates.',
        type: 'boolean',
        required: false,
        advanced: true
      },
      {
        name: 'WEBSOCKET_START_BODY_TEMPLATE',
        label: 'Start Body Template',
        description: 'Initial session setup message sent to the Websocket server right after connecting',
        type: 'json',
        required: false,
        advanced: true
      },
      {
        name: 'WEBSOCKET_REQUEST_BODY_RAW',
        label: 'Request Body Raw',
        description: 'If true, the request body is sent as plain string instead of JSON. Auto-set based on WEBSOCKET_REQUEST_BODY_TEMPLATE.',
        type: 'boolean',
        required: false,
        advanced: true
      },
      {
        name: 'WEBSOCKET_REQUEST_BODY_TEMPLATE',
        label: 'Request Body Template',
        description: 'Mustache template for converting the Botium message to the Websocket payload',
        type: 'json',
        required: false
      },
      {
        name: 'WEBSOCKET_REQUEST_HOOK',
        label: 'Request Hook',
        description: 'Hook function or inline code for customizing the outgoing Websocket request',
        type: 'hook',
        required: false,
        advanced: true
      },
      {
        name: 'WEBSOCKET_RESPONSE_RAW',
        label: 'Response Raw',
        description: 'If true, the response body is handled as plain string instead of JSON. Auto-set based on WEBSOCKET_RESPONSE_TEXTS_JSONPATH.',
        type: 'boolean',
        required: false,
        advanced: true
      },
      {
        name: 'WEBSOCKET_RESPONSE_TEXTS_JSONPATH',
        label: 'Response Texts JSONPath',
        description: 'JSONPath expression to extract the message text from the Websocket response',
        type: 'string',
        required: false
      },
      {
        name: 'WEBSOCKET_RESPONSE_BUTTONS_JSONPATH',
        label: 'Response Buttons JSONPath',
        description: 'JSONPath expression to extract button texts from the Websocket response',
        type: 'string',
        required: false,
        advanced: true
      },
      {
        name: 'WEBSOCKET_RESPONSE_MEDIA_JSONPATH',
        label: 'Response Media JSONPath',
        description: 'JSONPath expression to extract media attachments from the Websocket response',
        type: 'string',
        required: false,
        advanced: true
      },
      {
        name: 'WEBSOCKET_RESPONSE_HOOK',
        label: 'Response Hook',
        description: 'Hook function or inline code for customizing the incoming Websocket response',
        type: 'hook',
        required: false,
        advanced: true
      },
      {
        name: 'WEBSOCKET_RESPONSE_IGNORE_EMPTY',
        label: 'Ignore Empty Responses',
        description: 'If true, empty Websocket messages are ignored (default: true)',
        type: 'boolean',
        required: false,
        advanced: true
      }
    ]
  }
}
