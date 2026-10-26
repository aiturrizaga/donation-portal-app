FROM node:24.0.0-alpine3.21 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN cp .env.template .env
RUN npm run build
RUN mkdir -p /app/app-dist && cp -r dist/*/. /app/app-dist/

FROM node:24.0.0-alpine3.21 AS runtime
WORKDIR /app

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY --from=build --chown=appuser:appgroup /app/app-dist ./dist
COPY --from=build --chown=appuser:appgroup /app/package*.json ./
COPY --chown=appuser:appgroup .env.template /app/.env.template
COPY --chown=appuser:appgroup entrypoint.sh /entrypoint.sh

RUN sed -i 's/\r$//' /entrypoint.sh && \
    chmod +x /entrypoint.sh

USER appuser

ENV PORT=4000
EXPOSE 4000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/server/server.mjs"]
