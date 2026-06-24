FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# nsfwjs v4 bundles MobileNetV2 weights inside the npm package (node_modules/nsfwjs/dist/models/).
# No external download needed — npm ci (above) already includes all model files.

EXPOSE 4000
USER node
CMD ["node", "server.js"]
