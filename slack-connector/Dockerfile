# ./slack-connector/Dockerfile

# ---- Base Stage ----
    FROM node:18-alpine AS base
    WORKDIR /usr/src/app
    RUN apk add --no-cache dumb-init
    COPY package*.json ./
    ARG NODE_ENV=production
    ENV NODE_ENV=${NODE_ENV}
    
    # ---- Dependencies Stage ----
    FROM base AS dependencies
    RUN if [ "$NODE_ENV" = "production" ]; then \
          npm ci --only=production; \
        else \
          npm install; \
        fi
    
    # ---- Production Stage ----
    FROM base AS production
    # Copy installed dependencies
    COPY --from=dependencies /usr/src/app/node_modules ./node_modules
    # Copy application code
    COPY . .
    # Copy shared config/models from API project (ensure this path is correct relative to build context)
    # If building from root, paths might be './notification-api/config', etc.
    # Assuming build context is './slack-connector' for now:
    COPY config ./config
    COPY models ./models
    # Expose ports if needed (usually not for worker services)
    # EXPOSE ...
    # Set user
    # USER node
    ENTRYPOINT ["/usr/bin/dumb-init", "--"]
    CMD ["node", "src/connector.js"]