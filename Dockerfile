# Multi-stage Dockerfile for Node.js application
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Create logs directory
RUN mkdir -p logs
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Run database migrations in build stage
RUN npm run db:generate

# Production stage
FROM base AS production
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
# Copy application code
COPY --from=builder --chown=app:nodejs /app/src ./src
COPY --from=builder --chown=app:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=app:nodejs /app/package*.json ./
COPY --from=builder --chown=app:nodejs /app/drizzle.config.js ./

# Create logs directory with correct permissions
RUN mkdir -p logs && chown -R app:nodejs logs

USER app
EXPOSE 3000

ENV NODE_ENV=production
CMD ["node", "src/index.js"]
