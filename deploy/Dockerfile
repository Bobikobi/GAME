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

# DB-IP's free country file (CC BY 4.0, https://db-ip.com), fetched once per image from a pinned month and checked
# against its sha256: the server looks the client's country up in it (COUNTRY_DB). A newer month is two changed
# lines here, taken on purpose: the month and the sum of that month's file.
FROM node:24-alpine AS country
ARG DBIP_MONTH=2026-10
ARG DBIP_SHA256=4cd44536ddfd40fec7eca94a233f7d19f38d470e6522e653cb8d27001f5fe177
RUN wget -qO /country.mmdb.gz "https://download.db-ip.com/free/dbip-country-lite-${DBIP_MONTH}.mmdb.gz" \
 && echo "${DBIP_SHA256}  /country.mmdb.gz" | sha256sum -c - \
 && gunzip /country.mmdb.gz

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
# pg is the one runtime dependency the bundle leaves out, so it is installed here and nothing else
RUN npm install --omit=dev --no-audit --no-fund pg@8
COPY --from=build /out/main.mjs ./main.mjs
COPY --from=build /repo/game/src/generated/bundle.json ./bundle.json
COPY --from=build /repo/server/migrations ./migrations
COPY --from=country /country.mmdb ./country.mmdb
ENV MIGRATIONS=/app/migrations
ENV COUNTRY_DB=/app/country.mmdb
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s CMD wget -qO- http://127.0.0.1:8080/health >/dev/null 2>&1 || exit 1
CMD ["node", "main.mjs"]
