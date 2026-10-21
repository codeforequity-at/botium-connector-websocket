FROM node:24.19.0-alpine3.24

WORKDIR /usr/src/app

COPY package.json ./

# zlib 1.3.2-r0 in this tag is fixed by the Alpine 3.24 upgrade.
# npm and corepack ship with high and critical issues that no current npm
# release clears, and the server only needs the node binary at runtime.
RUN apk upgrade --no-cache \
 && npm install --omit=dev \
 && npm cache clean --force \
 && rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/lib/node_modules/corepack \
           /root/.npm \
 && rm -f /usr/local/bin/npm /usr/local/bin/npx \
          /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg

COPY index.js ./

EXPOSE 2345
EXPOSE 2346
CMD [ "node", "index.js" ]
