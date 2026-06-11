# Stage 1: Build the workspace
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root configurations and dependency manifests
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/poker-core/package.json ./packages/poker-core/
COPY packages/poker-client/package.json ./packages/poker-client/

# Install all dependencies
RUN npm ci

# Copy the actual package source code
COPY packages/poker-core ./packages/poker-core
COPY packages/poker-client ./packages/poker-client

# Build the workspaces
RUN npm run build --workspace=@poker-platform/poker-core
RUN npm run build --workspace=@poker-platform/poker-client

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY packages/poker-client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/poker-client/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
