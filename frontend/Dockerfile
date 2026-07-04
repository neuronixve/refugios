# Etapa de construcción
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Etapa de producción con Nginx
FROM nginx:alpine

# Creamos la estructura para servir bajo la subcarpeta /refugios
RUN mkdir -p /usr/share/nginx/html/refugios
COPY --from=build /app/dist /usr/share/nginx/html/refugios

# Copiamos la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
