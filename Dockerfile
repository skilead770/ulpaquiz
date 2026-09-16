# Use the official Node.js image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application
COPY . .

# Build the frontend and backend
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Start the server
CMD ["node", "dist/server.cjs"]
