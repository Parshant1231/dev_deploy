FROM nginx:alpine

# Copy static files
COPY . /usr/share/nginx/html

# Custom nginx config — adds /health endpoint so ALB health checks pass
RUN printf 'server {\n\
    listen 80;\n\
    server_name localhost;\n\
\n\
    # ALB / ECS health check endpoint\n\
    location /health {\n\
        access_log off;\n\
        return 200 "healthy";\n\
        add_header Content-Type text/plain;\n\
    }\n\
\n\
    # Serve static files\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html index.htm;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
