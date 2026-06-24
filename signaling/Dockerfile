FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# Download nsfwjs MobileNet v2 quantised model at build time so it's baked
# into the image — no CDN dependency at runtime on the VPS
RUN mkdir -p /app/nsfw_model && \
    wget -q -O /app/nsfw_model/model.json \
      "https://nsfwjs.com/quant_nsfw_mobilenet/model.json" && \
    cd /app/nsfw_model && \
    node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('model.json')); const shards=[...new Set(m.weightsManifest.flatMap(g=>g.paths))]; console.log(shards.join('\n'));" | \
    xargs -I{} wget -q -O /app/nsfw_model/{} \
      "https://nsfwjs.com/quant_nsfw_mobilenet/{}"

EXPOSE 4000
USER node
CMD ["node", "server.js"]
