# Use an official Node.js runtime as the parent image
FROM node:18

# Set the working directory to /usr/src/app
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./
# Install dependencies
RUN npm install
# copy env files
COPY env.sample .env
COPY ../.env ../.env

# Install dependencies
RUN npm install



# Copy all the files from the current directory to the working directory
COPY . ./

# Expose port 3000 for the API
EXPOSE 3000 

# Command to run when the container starts
CMD ["node", "src/index.js"]