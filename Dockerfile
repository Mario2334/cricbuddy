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

# Networking
# We use host networking via docker-compose (network_mode: host) on Linux, which exposes all
# container ports directly on the host. The EXPOSE line is informational only and not needed.
# Leaving it out avoids implying a limited port set when all ports are reachable on Linux host mode.

# Default command: run the dev server defined in package.json
# Adds --non-interactive for reliability in containers. Your script already uses --tunnel.
CMD ["npm", "run", "start"]
