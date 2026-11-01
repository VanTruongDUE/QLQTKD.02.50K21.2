FROM node:24-alpine
RUN npm install -g pnpm@10.32.1
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN pnpm build
