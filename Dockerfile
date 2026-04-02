# Multi-stage build for frontend
FROM node:22-alpine AS builder
WORKDIR /app

# Build args for Vite env vars (baked in at build time)
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production=false

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage - serve with lightweight server
FROM nginx:alpine

# Copy built assets to default nginx root
COPY --from=builder /app/dist /etc/nginx/html/

# Create nginx config
RUN cat > /etc/nginx/conf.d/spa.conf << 'EOFNGINX'
server {
    listen 80;
    server_name _;
    root /etc/nginx/html;
    
    # API proxy
    location /api/ {
        proxy_pass http://api:8080/api/;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
    }
    
    # Static assets
    location ~ \.(js|css|png|svg|woff|woff2|ttf|otf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # No cache for index.html
    location = /index.html {
        add_header Cache-Control "public, must-revalidate, max-age=0";
    }
}
EOFNGINX

# Remove the default config
RUN rm -f /etc/nginx/conf.d/default.conf

EXPOSE 80
