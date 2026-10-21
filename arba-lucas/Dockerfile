# Usamos una imagen oficial y liviana de Node.js
FROM node:20-alpine

# Directorio de trabajo en el contenedor
WORKDIR /app

# Copiamos definición de paquetes
COPY package*.json ./

# Instalamos dependencias de producción
RUN npm install --omit=dev

# Copiamos código fuente
COPY . .

# Variables de entorno por defecto
ENV PORT=3003
ENV NODE_ENV=production

# Exponemos el puerto normativo de cátedra para ARBA
EXPOSE 3003

# Comando para iniciar el servicio
CMD ["npm", "start"]
