# Use a lightweight Node.js image 
FROM node:22-alpine

# Set working directory
WORKDIR /src

# Set environment variables
ENV NODE_ENV="production"

# Copy package*.json and .env dependencies
COPY package*.json ./
COPY .env.template ./.env

# Install necessary system packages
RUN apk add --no-cache bash vim

# Install dependencies (with retry for QEMU flakiness on arm64)
RUN set -e; \
    success=0; \
    for i in 1 2 3; do \
        if npm ci --omit=dev --silent; then \
            success=1; \
            break; \
        fi; \
        echo "Retry $i: npm ci failed"; \
        if [ "$i" -lt 3 ]; then sleep 2; fi; \
    done; \
    if [ "$success" -ne 1 ]; then \
        echo "npm ci failed after retries"; \
        exit 1; \
    fi; \
    npm cache clean --force; \
    rm -rf /tmp/* /var/tmp/* /usr/share/doc/*

# Copy the application code
COPY frontend frontend
COPY backend backend

# Set default command to start the application
CMD ["npm", "start"]