const util = require('util')
const url = require('url')
const WebSocket = require('ws')
const _ = require('lodash')
const Mustache = require('mustache')
const jp = require('jsonpath')
const mime = require('mime-types')
const HttpsProxyAgent = require('https-proxy-agent')
const { getHook, executeHook } = require('botium-core/src/helpers/HookUtils')
const debug = require('debug')('botium-connector-websocket')

const Capabilities = {
  WEBSOCKET_URL: 'WEBSOCKET_URL',
  WEBSOCKET_HANDSHAKE_TIMEOUT: 'WEBSOCKET_HANDSHAKE_TIMEOUT',
  WEBSOCKET_REQUEST_BODY_RAW: 'WEBSOCKET_REQUEST_BODY_RAW',
  WEBSOCKET_REQUEST_BODY_TEMPLATE: 'WEBSOCKET_REQUEST_BODY_TEMPLATE',
  WEBSOCKET_REQUEST_HOOK: 'WEBSOCKET_REQUEST_HOOK',
  WEBSOCKET_RESPONSE_HOOK: 'WEBSOCKET_RESPONSE_HOOK',
  WEBSOCKET_RESPONSE_RAW: 'WEBSOCKET_RESPONSE_RAW',
  WEBSOCKET_RESPONSE_TEXTS_JSONPATH: 'WEBSOCKET_RESPONSE_TEXTS_JSONPATH',
  WEBSOCKET_RESPONSE_BUTTONS_JSONPATH: 'WEBSOCKET_RESPONSE_BUTTONS_JSONPATH',
  WEBSOCKET_RESPONSE_MEDIA_JSONPATH: 'WEBSOCKET_RESPONSE_MEDIA_JSONPATH',
  WEBSOCKET_RESPONSE_IGNORE_EMPTY: 'WEBSOCKET_RESPONSE_IGNORE_EMPTY'
}

const Defaults = {
  [Capabilities.WEBSOCKET_HANDSHAKE_TIMEOUT]: 10000,
  [Capabilities.WEBSOCKET_RESPONSE_IGNORE_EMPTY]: true
}

class BotiumConnectorWebsocket {
  constructor ({ queueBotSays, caps }) {
    this.queueBotSays = queueBotSays
    this.caps = caps
  }

  Validate () {
    debug('Validate called')
    this.caps = Object.assign({}, Defaults, this.caps)

    if (!_.has(this.caps, Capabilities.WEBSOCKET_REQUEST_BODY_RAW)) {
      this.caps[Capabilities.WEBSOCKET_REQUEST_BODY_RAW] = !this.caps[Capabilities.WEBSOCKET_REQUEST_BODY_TEMPLATE]
    }
    if (!_.has(this.caps, Capabilities.WEBSOCKET_RESPONSE_RAW)) {
      this.caps[Capabilities.WEBSOCKET_RESPONSE_RAW] = !this.caps[Capabilities.WEBSOCKET_RESPONSE_TEXTS_JSONPATH]
    }

    if (!this.caps[Capabilities.WEBSOCKET_URL]) throw new Error('WEBSOCKET_URL capability required')
    if (!this.caps[Capabilities.WEBSOCKET_REQUEST_BODY_RAW] && !this.caps[Capabilities.WEBSOCKET_REQUEST_BODY_TEMPLATE] && !this.caps[Capabilities.WEBSOCKET_REQUEST_HOOK]) throw new Error('WEBSOCKET_REQUEST_BODY_RAW or WEBSOCKET_REQUEST_BODY_TEMPLATE or WEBSOCKET_REQUEST_HOOK capability required')
    if (!this.caps[Capabilities.WEBSOCKET_RESPONSE_RAW] && !this.caps[Capabilities.WEBSOCKET_RESPONSE_TEXTS_JSONPATH] && !this.caps[Capabilities.WEBSOCKET_RESPONSE_HOOK]) throw new Error('WEBSOCKET_RESPONSE_RAW or WEBSOCKET_RESPONSE_TEXTS_JSONPATH or WEBSOCKET_RESPONSE_HOOK capability required')
    if (this.caps[Capabilities.WEBSOCKET_RESPONSE_RAW] && (this.caps[Capabilities.WEBSOCKET_RESPONSE_TEXTS_JSONPATH] || this.caps[Capabilities.WEBSOCKET_RESPONSE_BUTTONS_JSONPATH] || this.caps[Capabilities.WEBSOCKET_RESPONSE_MEDIA_JSONPATH])) throw new Error('No JSONPath parsing available when WEBSOCKET_RESPONSE_RAW is set')

    this.requestHook = getHook(this.caps, this.caps[Capabilities.WEBSOCKET_REQUEST_HOOK])
    this.responseHook = getHook(this.caps, this.caps[Capabilities.WEBSOCKET_RESPONSE_HOOK])
  }

  async Start () {
    debug('Start called')

    const wsOptions = {
      handshakeTimeout: this.caps[Capabilities.WEBSOCKET_HANDSHAKE_TIMEOUT]
    }

    return new Promise((resolve, reject) => {
      const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy
      const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy
      const proxy = httpsProxy || httpProxy

      if (proxy) {
        debug(`Using proxy ${proxy}`)
        const proxyOptions = {}
        if (proxy.startsWith('https') || proxy.startsWith('http')) {
          const proxyUrl = new url.URL(proxy)
          proxyOptions.host = proxyUrl.hostname
          proxyOptions.port = proxyUrl.port
          proxyOptions.protocol = proxyUrl.protocol
        } else {
          if (httpsProxy) proxyOptions.protocol = 'https:'
          else proxyOptions.protocol = 'http:'
          if (proxy.indexOf(':') > 0) {
            proxyOptions.host = httpsProxy.split(':')[0]
            proxyOptions.port = httpsProxy.split(':')[1]
          } else {
            proxyOptions.host = proxy
          }
        }
        wsOptions.agent = new HttpsProxyAgent(proxyOptions)
      }
      this.ws = new WebSocket(this.caps[Capabilities.WEBSOCKET_URL], wsOptions)

      this.wsOpened = false
      this.ws.on('open', () => {
        this.wsOpened = true
        debug(`Websocket connection to ${this.caps[Capabilities.WEBSOCKET_URL]} opened.`)
        resolve()
      })
      this.ws.on('close', () => {
        debug(`Websocket connection to ${this.caps[Capabilities.WEBSOCKET_URL]} closed.`)
      })
      this.ws.on('error', (err) => {
        debug(err)
        if (!this.wsOpened) {
          reject(new Error(`Websocket connection to ${this.caps[Capabilities.WEBSOCKET_URL]} error: ${err.message || err}`))
        }
      })
      this.ws.on('message', async (data) => {
        if (data || !this.caps[Capabilities.WEBSOCKET_RESPONSE_IGNORE_EMPTY]) {
          const raw = !!this.caps[Capabilities.WEBSOCKET_RESPONSE_RAW]
          if (raw) {
            await this._processBodyAsyncImpl(data || '', true)
          } else {
            if (data) {
              try {
                const body = JSON.parse(data)
                await this._processBodyAsyncImpl(body, false)
                debug(`Websocket connection to ${this.caps[Capabilities.WEBSOCKET_URL]} received and processed message: ${JSON.stringify(body)}`)
              } catch (err) {
                debug(`Websocket connection to ${this.caps[Capabilities.WEBSOCKET_URL]} received message, processing error: ${err.message || err}`)
              }
            } else {
              await this._processBodyAsyncImpl('', true)
            }
          }
        } else {
          debug(`Websocket connection to ${this.caps[Capabilities.WEBSOCKET_URL]} received empty message, ignored.`)
        }
      })
    })
  }

  async UserSays (msg) {
    debug('UserSays called')

    const view = {
      msg
    }

    const requestOptions = { }
    const raw = !!this.caps[Capabilities.WEBSOCKET_REQUEST_BODY_RAW]
    if (raw) {
      requestOptions.body = msg.messageText
    } else if (this.caps[Capabilities.WEBSOCKET_REQUEST_BODY_TEMPLATE]) {
      try {
        requestOptions.body = this._getMustachedCap(Capabilities.WEBSOCKET_REQUEST_BODY_TEMPLATE, view, !raw)
      } catch (err) {
        throw new Error(`composing body from WEBSOCKET_REQUEST_BODY_TEMPLATE failed (${err.message})`)
      }
    }
    await executeHook(this.caps, this.requestHook, Object.assign({ requestOptions }, view))
    if (raw) this.ws.send(requestOptions.body || '')
    else this.ws.send(JSON.stringify(requestOptions.body || {}))
  }

  async Stop () {
    debug('Stop called')
    if (this.ws) {
      this.ws.close()
    }
    this.wsOpened = false
    this.ws = null
  }

  async _processBodyAsyncImpl (body, raw) {
    const botMsgs = []

    const media = []
    const buttons = []

    if (raw) {
      const botMsg = { messageText: body, sourceData: body, media, buttons }
      await executeHook(this.caps, this.responseHook, { botMsg })
      botMsgs.push(botMsg)
    } else {
      if (this.caps[Capabilities.WEBSOCKET_RESPONSE_MEDIA_JSONPATH]) {
        const responseMedia = jp.query(body, this.caps[Capabilities.WEBSOCKET_RESPONSE_MEDIA_JSONPATH])
        if (responseMedia) {
          (_.isArray(responseMedia) ? _.flattenDeep(responseMedia) : [responseMedia]).forEach(m =>
            media.push({
              mediaUri: m,
              mimeType: mime.lookup(m) || 'application/unknown'
            })
          )
          debug(`found response media: ${util.inspect(media)}`)
        }
      }
      if (this.caps[Capabilities.WEBSOCKET_RESPONSE_BUTTONS_JSONPATH]) {
        const responseButtons = jp.query(body, this.caps[Capabilities.WEBSOCKET_RESPONSE_BUTTONS_JSONPATH])
        if (responseButtons) {
          (_.isArray(responseButtons) ? _.flattenDeep(responseButtons) : [responseButtons]).forEach(b =>
            buttons.push({
              text: b
            })
          )
          debug(`found response buttons: ${util.inspect(buttons)}`)
        }
      }

      let hasMessageText = false
      if (this.caps[Capabilities.WEBSOCKET_RESPONSE_TEXTS_JSONPATH]) {
        const responseTexts = jp.query(body, this.caps[Capabilities.WEBSOCKET_RESPONSE_TEXTS_JSONPATH])
        debug(`found response texts: ${util.inspect(responseTexts)}`)

        const messageTexts = (_.isArray(responseTexts) ? _.flattenDeep(responseTexts) : [responseTexts])
        for (const messageText of messageTexts) {
          if (!messageText) continue

          hasMessageText = true
          const botMsg = { sourceData: body, messageText, media, buttons }
          await executeHook(this.caps, this.responseHook, { botMsg })
          botMsgs.push(botMsg)
        }
      }
      if (!hasMessageText) {
        const botMsg = { messageText: '', sourceData: body, media, buttons }
        const beforeHookKeys = Object.keys(botMsg)
        await executeHook(this.caps, this.responseHook, { botMsg })
        const afterHookKeys = Object.keys(botMsg)
        if (beforeHookKeys.length !== afterHookKeys.length || media.length > 0 || buttons.length > 0 || !this.caps[Capabilities.WEBSOCKET_RESPONSE_IGNORE_EMPTY]) {
          botMsgs.push(botMsg)
        }
      }
    }

    botMsgs.forEach(botMsg => setTimeout(() => this.queueBotSays(botMsg), 0))
  }

  _getMustachedCap (capName, view, json) {
    const template = _.isString(this.caps[capName]) ? this.caps[capName] : JSON.stringify(this.caps[capName])
    return this._getMustachedVal(template, view, json)
  }

  _getMustachedVal (template, view, json) {
    if (json) {
      return JSON.parse(Mustache.render(template, view))
    } else {
      return Mustache.render(template, view)
    }
  }
}

module.exports = BotiumConnectorWebsocket
