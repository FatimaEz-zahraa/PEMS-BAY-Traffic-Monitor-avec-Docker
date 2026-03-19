FROM nginx:alpine

LABEL description="PEMS-BAY Frontend — Nginx + Leaflet.js"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
