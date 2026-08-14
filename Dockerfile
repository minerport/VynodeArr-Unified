FROM node:24-alpine AS web-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund
COPY apps/web/client ./apps/web/client
COPY apps/api ./apps/api
COPY packages ./packages
COPY tsconfig.server.json ./
RUN npm run typecheck:web && npm run build:web && npm run build:server

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache font-dejavu ffmpeg yt-dlp
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY apps ./apps
COPY --from=web-build /app/apps/web/public/react ./apps/web/public/react
COPY --from=web-build /app/.server-build/apps/api ./apps/api
COPY --from=web-build /app/.server-build/packages ./packages
COPY OPEN_SOURCE_NOTICES LICENSE THIRD_PARTY_NOTICES ./
RUN adduser -S -G node -u 10001 vynodearr \
    && mkdir -p /data /movies /tv /downloads \
    && chown -R vynodearr:node /app /data /movies /tv /downloads
USER vynodearr
ENV PORT=4310 \
    VYNODEARR_DATA_DIR=/data \
    VYNODEARR_MOVIE_LIBRARY_PATH=/movies \
    VYNODEARR_TV_LIBRARY_PATH=/tv \
    VYNODEARR_TRAILER_DIR=/movies \
    VYNODEARR_MOVIE_DOWNLOADS_PATH=/downloads \
    VYNODEARR_TV_DOWNLOADS_PATH=/downloads
VOLUME ["/data", "/movies", "/tv", "/downloads"]
EXPOSE 4310
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4310/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/api/src/server.js"]
