# The API image (NEXT 18 a/b): build the bundle and the server into one file, then keep only what runs.
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY kernel ./kernel
COPY schema ./schema
COPY tools ./tools
COPY content ./content
COPY server ./server
RUN pnpm install --frozen-lockfile
RUN pnpm bundle
RUN pnpm exec esbuild server/src/main.ts --bundle --platform=node --format=esm --target=node24 \
      --outfile=/out/main.mjs --external:pg --external:pg-native

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
# pg is the one runtime dependency the bundle leaves out, so it is installed here and nothing else
RUN npm install --omit=dev --no-audit --no-fund pg@8
COPY --from=build /out/main.mjs ./main.mjs
COPY --from=build /repo/game/src/generated/bundle.json ./bundle.json
COPY --from=build /repo/server/migrations ./migrations
ENV MIGRATIONS=/app/migrations
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s CMD wget -qO- http://127.0.0.1:8080/state >/dev/null 2>&1 || exit 1
CMD ["node", "main.mjs"]
