FROM node:20-slim

# Install Python and pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Create and activate Python virtual environment
RUN python3 -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"

# Copy Python requirements
COPY requirements.txt ./

# Install Python dependencies in virtual environment
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Create a script to run both servers
RUN echo '#!/bin/bash\n\
    source /app/venv/bin/activate\n\
    python3 main.py & \
    node src/server.js & \
    wait' > /app/start-servers.sh

RUN chmod +x /app/start-servers.sh

# Expose ports for both servers
EXPOSE 5000 4000

# Start both servers
CMD ["/app/start-servers.sh"] 