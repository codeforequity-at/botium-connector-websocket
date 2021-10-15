# Botium Connector for Websocket Endpoint

[![NPM](https://nodei.co/npm/botium-connector-websocket.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/botium-connector-websocket/)

[![Codeship Status for codeforequity-at/botium-connector-websocket](https://app.codeship.com/projects/60211350-dba2-0137-2a2e-422ecf3ee4c1/status?branch=master)](https://app.codeship.com/projects/371437)
[![npm version](https://badge.fury.io/js/botium-connector-websocket.svg)](https://badge.fury.io/js/botium-connector-websocket)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg)]()

This is a [Botium](https://github.com/codeforequity-at/botium-core) connector for testing your chatbot published on a [Websocket endpoint](https://en.wikipedia.org/wiki/WebSocket).

__Did you read the [Botium in a Nutshell](https://medium.com/@floriantreml/botium-in-a-nutshell-part-1-overview-f8d0ceaf8fb4) articles? Be warned, without prior knowledge of Botium you won't be able to properly use this library!__

## How it works
Botium connects to your Websocket endpoint by transforming the Botium internal message representation to match your communication protocol in both directions (user to bot, bot to user).

It can be used as any other Botium connector with all Botium Stack components:
* [Botium CLI](https://github.com/codeforequity-at/botium-cli/)
* [Botium Bindings](https://github.com/codeforequity-at/botium-bindings/)
* [Botium Box](https://www.botium.ai)

## Requirements
* **Node.js and NPM**
* a bot published on a **Websocket endpoint**
* a **project directory** on your workstation to hold test cases and Botium configuration

## Install Botium and Websocket Connector

When using __Botium CLI__:

```
> npm install -g botium-cli
> npm install -g botium-connector-websocket
> botium-cli init
> botium-cli run
```

When using __Botium Bindings__:

```
> npm install -g botium-bindings
> npm install -g botium-connector-websocket
> botium-bindings init mocha
> npm install && npm run mocha
```

When using __Botium Box__:

_Already integrated into Botium Box, no setup required_

## Connecting Websocket chatbot to Botium

Create a botium.json with the the URL of your Websocket installation in your project directory:

```
{
  "botium": {
    "Capabilities": {
      "PROJECTNAME": "Botium Project Websocket",
      "CONTAINERMODE": "websocket",
      "WEBSOCKET_URL": "ws://127.0.0.1:2345",
      "WEBSOCKET_REQUEST_BODY_TEMPLATE": {
        "conversationId": "botium",
        "text": "{{msg.messageText}}"
      },
      "WEBSOCKET_RESPONSE_TEXTS_JSONPATH": "$.text"
    }
  }
}
```

To check the configuration, run the emulator (Botium CLI required) to bring up a chat interface in your terminal window:

```
> botium-cli emulator
```

Botium setup is ready.

## Using a Proxy

The connector checks for the HTTPS_PROXY and HTTP_PROXY environment variables.

## How to start sample

There is a simple *Echo*-bot included, see [samples/echoserver](./samples/echoserver) folder. You have to start it before running the samples:

```
> npm install && npm run echoserver
```

Now you can start the included Botium samples:

```
> cd ./samples/echo
> npm install && npm test
```

## Supported Capabilities

Set the capability __CONTAINERMODE__ to __websocket__ to activate this connector.

### WEBSOCKET_URL
Websocket endpoint URL, starting with _ws://_ or _wss://_

### WEBSOCKET_HEADERS_TEMPLATE
Websocket HTTP Headers

### WEBSOCKET_HANDSHAKE_TIMEOUT
_Default: 10000 (10 sec)_

Opening handshake timeout

### WEBSOCKET_START_BODY_TEMPLATE
Initial "session setup" message sent from Botium to the Websocket server, right after connecting.

### WEBSOCKET_REQUEST_BODY_RAW
If set to _true_, the request body is sent as plain string, otherwise JSON formatting is applied.

If not given, this is automatically set to _true_ if the _WEBSOCKET\_REQUEST\_BODY\_TEMPLATE_ capabilitiy is given

### WEBSOCKET_REQUEST_BODY_TEMPLATE
[Mustache template](https://mustache.github.io/) for converting the Botium internal message structure to the Websocket payload as required for your communication protocol.

The Mustache view contains the Botium internal message structure in the _msg_ field, see [Botium Wiki](https://botium.atlassian.net/wiki/spaces/BOTIUM/pages/38502401/Howto+develop+your+own+Botium+connector#The-outgoing-message). Example:

    ...
    "WEBSOCKET_REQUEST_BODY_TEMPLATE": {
       "conversationId": "botium",
       "text": "{{msg.messageText}}"
    },
    ...

### WEBSOCKET_RESPONSE_RAW
If set to _true_, the response body is handles as plain string, otherwise JSON parsing is applied.

If not given, this is automatically set to _true_ if the _WEBSOCKET\_RESPONSE\_TEXTS\_JSONPATH_ capabilitiy is given. The _WEBSOCKET\_RESPONSE\_*_-JSONPath expressions are only possible if this capability is set to _false_.

### WEBSOCKET_RESPONSE_TEXTS_JSONPATH
[JSONPath expression](https://github.com/dchester/jsonpath) to extract the message text from the Websocket response.

### WEBSOCKET_RESPONSE_BUTTONS_JSONPATH
[JSONPath expression](https://github.com/dchester/jsonpath) to extract button texts from the Websocket response.

### WEBSOCKET_RESPONSE_MEDIA_JSONPATH
[JSONPath expression](https://github.com/dchester/jsonpath) to extract media attachments from the Websocket response.

### WEBSOCKET_REQUEST_HOOK
tbd

### WEBSOCKET_RESPONSE_HOOK
tbd

### WEBSOCKET_RESPONSE_IGNORE_EMPTY
tbd

## Current Restrictions

* Only JSON data supported


