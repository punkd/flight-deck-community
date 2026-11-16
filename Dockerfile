FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY app ./app
COPY public ./public
COPY server ./server
COPY index.html vite.config.ts tsconfig.json ./
RUN npm run check && npm test && npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=8080 BIND_HOST=0.0.0.0 DATABASE_PATH=/var/lib/flight-deck/tracker.sqlite
WORKDIR /app
RUN install -d -o node -g node /var/lib/flight-deck
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/app.mjs /app/server/index.mjs ./server/
COPY --from=build /app/app/tracker-model.ts ./app/
COPY --from=build /app/package.json ./
USER node
EXPOSE 8080
CMD ["node","server/index.mjs"]
