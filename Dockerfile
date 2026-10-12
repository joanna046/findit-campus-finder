FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci || npm install
COPY . .
ARG VITE_API_BASE_URL=https://findit-backend-71315479004.asia-south1.run.app
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/.output ./.output
ENV NODE_ENV=production
CMD ["node", ".output/server/index.mjs"]