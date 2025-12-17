FROM node:22-slim

WORKDIR /app

# Install mcp-proxy for HTTP transport
RUN npm install -g mcp-proxy

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY dist/ ./dist/

# Create non-root user
RUN useradd --create-home --shell /bin/bash app \
    && chown -R app:app /app
USER app

# Expose MCP port
EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

# Run with mcp-proxy for HTTP transport
CMD ["npx", "mcp-proxy", "--port", "8080", "node", "dist/mcp-server.js"]
