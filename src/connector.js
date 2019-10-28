const util = require('util')
const WebSocket = require('ws')
const _ = require('lodash')
const Mustache = require('mustache')
const jp = require('jsonpath')
const mime = require('mime-types')
const path = require('path')
const fs = require('fs')
const vm = require('vm')
const esprima = require('esprima')
const debug = require('debug')('botium-connector-websocket')

const Capabilities = {
  WEBSOCKET_URL: 'WEBSOCKET_URL',
  WEBSOCKET_REQUEST_BODY_TEMPLATE: 'WEBSOCKET_REQUEST_BODY_TEMPLATE',
  WEBSOCKET_REQUEST_HOOK: 'WEBSOCKET_REQUEST_HOOK',
  WEBSOCKET_RESPONSE_HOOK: 'WEBSOCKET_RESPONSE_HOOK',
  WEBSOCKET_RESPONSE_TEXTS_JSONPATH: 'WEBSOCKET_RESPONSE_TEXTS_JSONPATH',
  WEBSOCKET_RESPONSE_BUTTONS_JSONPATH: 'WEBSOCKET_RESPONSE_BUTTONS_JSONPATH',
  WEBSOCKET_RESPONSE_MEDIA_JSONPATH: 'WEBSOCKET_RESPONSE_MEDIA_JSONPATH'
}

const Defaults = {
}

class BotiumConnectorWebsocket {
  constructor ({ queueBotSays, caps }) {
    this.queueBotSays = queueBotSays
    this.caps = caps
  }

  Validate () {
    debug('Validate called')
    this.caps = Object.assign({}, Defaults, this.caps)

    if (!this.caps[Capabilities.WEBSOCKET_URL]) throw new Error('WEBSOCKET_URL capability required')
    if (!this.caps[Capabilities.WEBSOCKET_REQUEST_BODY_TEMPLATE] && !this.caps[Capabilities.WEBSOCKET_REQUEST_HOOK]) throw new Error('WEBSOCKET_REQUEST_BODY_TEMPLATE or WEBSOCKET_REQUEST_HOOK capability required')
    if (!this.caps[Capabilities.WEBSOCKET_RESPONSE_TEXTS_JSONPATH] && !this.caps[Capabilities.WEBSOCKET_RESPONSE_HOOK]) throw new Error('WEBSOCKET_RESPONSE_TEXTS_JSONPATH or WEBSOCKET_RESPONSE_HOOK capability required')

    this.requestHook = this._getHook(this.caps[Capabilities.WEBSOCKET_REQUEST_HOOK])
    this.responseHook = this._getHook(this.caps[Capabilities.WEBSOCKET_RESPONSE_HOOK])
  }

  async Start () {
    debug('Start called')

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.caps[Capabilities.WEBSOCKET_URL])
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
        if (data) {
          try {
            const body = JSON.parse(data)
            await this._processBodyAsyncImpl(body)
            debug(`Websocket connection to ${this.caps[Capabilities.WEBSOCKET_URL]} received and processed message: ${JSON.stringify(body)}`)
          } catch (err) {
            debug(`Websocket connection to ${this.caps[Capabilities.WEBSOCKET_URL]} received message, processing error: ${err.message || err}`)
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
    if (this.caps[Capabilities.WEBSOCKET_REQUEST_BODY_TEMPLATE]) {
      try {
        requestOptions.body = this._getMustachedCap(Capabilities.WEBSOCKET_REQUEST_BODY_TEMPLATE, view, true)
      } catch (err) {
        throw new Error(`composing body from WEBSOCKET_REQUEST_BODY_TEMPLATE failed (${util.inspect(err)})`)
      }
    }
    await this._executeHookWeak(this.requestHook, Object.assign({ requestOptions }, view))
    this.ws.send(JSON.stringify(requestOptions.body))
  }

  async Stop () {
    debug('Stop called')
    if (this.ws) {
      this.ws.close()
    }
    this.wsOpened = false
    this.ws = null
  }

  async _processBodyAsyncImpl (body) {
    const botMsgs = []

    const media = []
    const buttons = []

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
        if (!messageText) return

        hasMessageText = true
        const botMsg = { sourceData: body, messageText, media, buttons }
        await this._executeHookWeak(this.responseHook, { botMsg })
        botMsgs.push(botMsg)
      }
    }

    if (!hasMessageText) {
      const botMsg = { messageText: '', sourceData: body, media, buttons }
      await this._executeHookWeak(this.responseHook, { botMsg })
      botMsgs.push(botMsg)
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

  async _executeHookWeak (hook, args) {
    if (!hook) {
      return
    }
    if (_.isFunction(hook)) {
      await hook(args)
      return
    }
    if (_.isString(hook)) {
      // we let to alter args this way
      vm.createContext(args)
      vm.runInContext(hook, args)
      return
    }

    throw new Error(`Unknown hook ${typeof hook}`)
  }

  _getHook (data) {
    if (!data) {
      return null
    }

    if (_.isFunction(data)) {
      debug('found hook, type: function definition')
      return data
    }

    let resultWithRequire
    let tryLoadFile = path.resolve(process.cwd(), data)
    if (fs.existsSync(tryLoadFile)) {
      resultWithRequire = require(tryLoadFile)
    }

    tryLoadFile = data
    try {
      resultWithRequire = require(data)
    } catch (err) {
    }

    if (resultWithRequire) {
      if (_.isFunction(resultWithRequire)) {
        debug('found hook, type: require')
        return resultWithRequire
      } else {
        throw new Error(`Cant load hook ${tryLoadFile} because it is not a function`)
      }
    }

    if (_.isString(data)) {
      try {
        esprima.parseScript(data)
      } catch (err) {
        throw new Error(`Cant load hook, syntax is not valid - ${util.inspect(err)}`)
      }

      debug('Found hook, type: JavaScript as String')
      return data
    }

    throw new Error(`Not valid hook ${util.inspect(data)}`)
  }
}

module.exports = BotiumConnectorWebsocket
