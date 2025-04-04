# ./notification-api/Dockerfile

# ---- Base Stage ----
    FROM node:18-alpine AS base
    WORKDIR /usr/src/app
    # Install base dependencies
    RUN apk add --no-cache dumb-init # Use dumb-init to handle signals properly
    # Copy only package files first for layer caching
    COPY package*.json ./
    # Set NODE_ENV for dependencies install
    ARG NODE_ENV=production
    ENV NODE_ENV=${NODE_ENV}
    
    
    # ---- Dependencies Stage ----
    FROM base AS dependencies
    # Install dependencies based on NODE_ENV
    RUN if [ "$NODE_ENV" = "production" ]; then \
          npm ci --only=production; \
        else \
          # Install all dependencies including devDependencies if not production
          npm install; \
        fi
    # Copy prisma schema if you were using it (not used here)
    # COPY prisma ./prisma/
    
    
    # ---- Build Stage (Optional - if you have a build step like TypeScript) ----
    # FROM dependencies AS build
    # Copy source code
    # COPY . .
    # Run build command if any (e.g., tsc)
    # RUN npm run build
    
    
    # ---- Production Stage ----
    FROM base AS production
    # Copy installed dependencies from 'dependencies' stage
    COPY --from=dependencies /usr/src/app/node_modules ./node_modules
    # Copy application code (or build output from 'build' stage)
    COPY . .
    # Copy migration files and sequelize config (needed if migrations run from container)
    COPY config ./config
    COPY models ./models
    COPY migrations ./migrations
    # Ensure correct ownership if needed (less common with node alpine)
    # RUN chown -R node:node .
    
    # Expose the application port
    EXPOSE ${PORT:-3000}
    
    # Set user (optional but good practice)
    # USER node
    
    # Use dumb-init to run your application
    # This ensures signals (like SIGTERM for graceful shutdown) are passed correctly
    ENTRYPOINT ["/usr/bin/dumb-init", "--"]
    
    # Command to run the application
    # Use node directly, not npm start, for better signal handling with dumb-init
    CMD ["node", "src/server.js"]