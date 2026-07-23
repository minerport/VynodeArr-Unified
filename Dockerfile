FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY apps ./apps
COPY packages ./packages
COPY OPEN_SOURCE_NOTICES LICENSE THIRD_PARTY_NOTICES ./
RUN addgroup -S vynodearr && adduser -S -G vynodearr -u 10001 vynodearr \
    && mkdir -p /data && chown -R vynodearr:vynodearr /app /data
USER vynodearr
ENV PORT=4310 VYNODEARR_DATA_DIR=/data
EXPOSE 4310
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4310/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/api/src/server.js"]
