# Use official Node.js 18 Alpine image
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat curl
WORKDIR /app


# Copy root package files (monorepo workspace)
COPY ../../package.json ../../package-lock.json ./
# Copy API package files
COPY package.json ./

# Install dependencies for this workspace only
RUN npm ci --only=production --no-audit --no-fund --workspace=apps/api --ignore-scripts --ignore-scripts

# Build stage
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./../../node_modules
COPY --from=deps /app/package.json ./package.json

# Copy source code
COPY . .

# Install dev dependencies needed for build
RUN npm install --only=development --no-audit --no-fund

# Build the application
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S apiuser -u 1001

# Copy built application and production dependencies
COPY --from=deps /app/../../node_modules ./../../node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=builder /app/dist ./dist

# Change ownership of the app directory
RUN chown -R apiuser:nodejs /app
USER apiuser

# Expose port
EXPOSE 5000

# Set environment to production
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Start the application
CMD ["npm", "start"]
