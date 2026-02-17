# Use an official Node.js runtime as the parent image
FROM node:20
WORKDIR /usr/src/app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm install

# Copy app source
COPY . .

# Entrypoint
RUN chmod +x /usr/src/app/entrypoint.sh

ENTRYPOINT ["/usr/src/app/entrypoint.sh"]

# Expose only if API uses it
EXPOSE 3000
