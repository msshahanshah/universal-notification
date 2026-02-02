FROM node:18-alpine

WORKDIR /usr/src/app

# Install dependencies first (better caching)
COPY package*.json ./ 
RUN npm install

# Copy app source code
COPY . .

# Entrypoint
RUN chmod +x /usr/src/app/entrypoint.sh 

ENTRYPOINT ["/usr/src/app/entrypoint.sh"]

# Expose only if API uses it
EXPOSE 3000
