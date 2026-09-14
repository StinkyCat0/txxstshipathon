FROM node:20-alpine

# Install watchman for better file watching
RUN apk add --no-cache watchman git

WORKDIR /app

# Copy package files first (better caching)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Install Expo CLI globally
RUN npm install -g expo-cli

# Copy the rest
COPY . .

# Expose Metro bundler port
EXPOSE 8081

# Expose dev tools
EXPOSE 19000
EXPOSE 19001
EXPOSE 19002

# Start Expo with tunnel mode (works across networks)
CMD ["npx", "expo", "start", "--tunnel", "--clear"]
