# Use a lightweight Node.js image 
FROM node:24-alpine

# Set working directory
WORKDIR /src

# Set environment variables
ENV NODE_ENV="production"

# Copy package*.json and .env dependencies
COPY package*.json ./
COPY .env.template ./.env

# Install necessary system packages
RUN apk add --no-cache bash vim

# Install dependencies
RUN npm ci --omit=dev --silent; \
    npm cache clean --force; \
    rm -rf /tmp/* /var/tmp/* /usr/share/doc/*

# Copy the application code, already owned by the runtime user
COPY --chown=node:node frontend frontend
COPY --chown=node:node backend backend

# Run as the non-root "node" user (uid/gid 1000) shipped with the base image
USER node

# Set default command to start the application
CMD ["npm", "start"]