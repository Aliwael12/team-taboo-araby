# Generic container for any host (Fly.io, Railway, a VPS, etc.)
FROM node:20-alpine
WORKDIR /app

# Install server deps
COPY package*.json ./
RUN npm install --omit=dev

# Build the client
COPY client/package*.json ./client/
RUN npm --prefix client install
COPY . .
RUN npm --prefix client run build

ENV PORT=3001
EXPOSE 3001
CMD ["npm", "start"]
