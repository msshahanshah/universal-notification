# ./notification-api/Dockerfile

FROM node:18

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all files to the working directory
COPY . .

# Expose the port the app runs in
EXPOSE 3000

# Define the default command to run when the container starts
CMD ["node", "src/server.js"]