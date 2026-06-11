# Stage 1: Build the workspace
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root configurations and dependency manifests
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/poker-core/package.json ./packages/poker-core/
COPY packages/poker-server/package.json ./packages/poker-server/

# Install all dependencies
RUN npm ci

# Copy the actual package source code
COPY packages/poker-core ./packages/poker-core
COPY packages/poker-server ./packages/poker-server

# Build the workspaces
RUN npm run build --workspace=@poker-platform/poker-core
RUN npm run build --workspace=@poker-platform/poker-server

# Stage 2: Runtime image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy root configs and package.jsons
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/poker-core/package.json ./packages/poker-core/
COPY packages/poker-server/package.json ./packages/poker-server/

# Copy the built distributions from builder stage
COPY --from=builder /app/packages/poker-core/dist ./packages/poker-core/dist
COPY --from=builder /app/packages/poker-server/dist ./packages/poker-server/dist

# Install production-only dependencies
RUN npm ci --omit=dev

EXPOSE 3000
CMD ["npm", "start", "--workspace=@poker-platform/poker-server"]
