# Lightweight Node base image
FROM node:20-bullseye

# Install minimal packages often useful when working with repos and Expo
RUN apt-get update \
    && apt-get install -y --no-install-recommends git openssh-client \
    && rm -rf /var/lib/apt/lists/*

# Preinstall ngrok tunnel helper used by Expo when --tunnel is enabled
# Prevent interactive prompt: "The package @expo/ngrok@^4.1.0 is required to use tunnels..."
RUN npm i -g --no-audit --no-fund @expo/ngrok@^4.1.0

# Create app directory
WORKDIR /app

# Install dependencies first (leverage Docker layer caching)
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Copy the rest of the app
COPY . .

# Environment to avoid interactive prompts in CI/containers
ENV CI=true \
    EXPO_NO_TELEMETRY=1 \
    EXPO_NO_INTERACTIVE=1

# Common Expo/Metro ports
# 19000: Expo dev server (LAN/tunnel)
# 19001: Legacy manifest/packager (sometimes used)
# 19002: Expo web UI (older)
# 19006: Expo web (when using --web)
# 8081: Metro bundler
EXPOSE 19000 19001 19002 19006 8081

# Default command: run the dev server defined in package.json
# Adds --non-interactive for reliability in containers. Your script already uses --tunnel.
CMD ["npm", "run", "start", "--", "--non-interactive"]
