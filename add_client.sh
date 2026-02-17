#!/bin/bash
# add_client.sh - Script to add a new client to Universal Notification System
# Usage: ./add_client.sh CLIENT_ID PORT

set -e  # Exit on error

CLIENT_ID=$1
CLIENT_PORT=$2
CLIENT_SCHEMA=$(echo "$CLIENT_ID" | tr '[:upper:]' '[:lower:]')

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ $1${NC}"; }

# Validate arguments
if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_PORT" ]; then
    print_error "Missing required arguments"
    echo ""
    echo "Usage: ./add_client.sh CLIENT_ID PORT"
    echo "Example: ./add_client.sh NEWCORP 3003"
    echo ""
    echo "Arguments:"
    echo "  CLIENT_ID   Unique identifier for the client (uppercase, e.g., NEWCORP)"
    echo "  PORT        Unique port number (e.g., 3003, 3004, etc.)"
    exit 1
fi

# Validate CLIENT_ID format (uppercase letters and underscores only)
if ! [[ "$CLIENT_ID" =~ ^[A-Z_]+$ ]]; then
    print_error "CLIENT_ID must contain only uppercase letters and underscores"
    exit 1
fi

# Validate PORT is a number
if ! [[ "$CLIENT_PORT" =~ ^[0-9]+$ ]]; then
    print_error "PORT must be a number"
    exit 1
fi

# Check if port is in valid range
if [ "$CLIENT_PORT" -lt 1024 ] || [ "$CLIENT_PORT" -gt 65535 ]; then
    print_error "PORT must be between 1024 and 65535"
    exit 1
fi

echo ""
print_info "Adding new client: $CLIENT_ID"
print_info "Port: $CLIENT_PORT"
print_info "Database Schema: $CLIENT_SCHEMA"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if containers are running
if ! docker-compose ps | grep -q "Up"; then
    print_warning "Docker containers may not be running. Starting them..."
    docker-compose up -d
    sleep 5
fi

# Create schema and table
print_info "Creating database schema and table..."
cat <<EOF | docker-compose exec -T postgres psql -U postgres -d notifications_db
-- Create schema
CREATE SCHEMA IF NOT EXISTS $CLIENT_SCHEMA;

-- Create notifications table
CREATE TABLE IF NOT EXISTS $CLIENT_SCHEMA.notifications (
    id SERIAL PRIMARY KEY,
    "messageId" UUID NOT NULL UNIQUE,
    service VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    content JSONB NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    "connectorResponse" TEXT,
    "templateId" VARCHAR(255),
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS ${CLIENT_SCHEMA}_notifications_message_id ON $CLIENT_SCHEMA.notifications("messageId");
CREATE INDEX IF NOT EXISTS ${CLIENT_SCHEMA}_notifications_status ON $CLIENT_SCHEMA.notifications(status);
CREATE INDEX IF NOT EXISTS ${CLIENT_SCHEMA}_notifications_service_status ON $CLIENT_SCHEMA.notifications(service, status);
EOF

if [ $? -eq 0 ]; then
    print_success "Database schema and table created successfully"
else
    print_error "Failed to create database schema and table"
    exit 1
fi

# Verify schema creation
print_info "Verifying schema creation..."
SCHEMA_EXISTS=$(docker-compose exec -T postgres psql -U postgres -d notifications_db -tAc "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = '$CLIENT_SCHEMA';")

if [ "$SCHEMA_EXISTS" -eq 1 ]; then
    print_success "Schema verified: $CLIENT_SCHEMA"
else
    print_error "Schema verification failed"
    exit 1
fi

# Verify table creation
TABLE_EXISTS=$(docker-compose exec -T postgres psql -U postgres -d notifications_db -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$CLIENT_SCHEMA' AND table_name = 'notifications';")

if [ "$TABLE_EXISTS" -eq 1 ]; then
    print_success "Table verified: $CLIENT_SCHEMA.notifications"
else
    print_error "Table verification failed"
    exit 1
fi

echo ""
print_success "Database setup completed successfully!"
echo ""
print_warning "NEXT STEPS:"
echo ""
echo "1. Add the following configuration to clientList.json:"
echo ""
echo "  {"
echo "    \"ID\": \"$CLIENT_ID\","
echo "    \"SERVER_PORT\": $CLIENT_PORT,"
echo "    \"ENABLED_SERVERICES\": [\"slack\", \"email\", \"sms\"],"
echo "    \"SLACKBOT\": {"
echo "      \"TOKEN\": \"xoxb-your-slack-token\","
echo "      \"RABBITMQ\": {"
echo "        \"EXCHANGE_NAME\": \"notifications_exchange\","
echo "        \"EXCHANGE_TYPE\": \"direct\","
echo "        \"QUEUE_NAME\": \"slackbot_queue\","
echo "        \"ROUTING_KEY\": \"slack\""
echo "      }"
echo "    },"
echo "    \"EMAIL\": { ... },"
echo "    \"SMS\": { ... },"
echo "    \"DBCONFIG\": {"
echo "      \"HOST\": \"localhost\","
echo "      \"PORT\": 54333,"
echo "      \"NAME\": \"notifications_db\","
echo "      \"USER\": \"postgres\","
echo "      \"PASSWORD\": \"admin\""
echo "    },"
echo "    \"RABBITMQ\": {"
echo "      \"HOST\": \"localhost\","
echo "      \"PORT\": 5672,"
echo "      \"USER\": \"user\","
echo "      \"PASSWORD\": \"password\","
echo "      \"EXCHANGE_NAME\": \"notifications_exchange\","
echo "      \"EXCHANGE_TYPE\": \"direct\","
echo "      \"QUEUE_NAME\": \"notifications_queue\","
echo "      \"ROUTING_KEY\": \"notifications\""
echo "    }"
echo "  }"
echo ""
echo "2. Restart the notification-api service:"
echo "   ${BLUE}docker-compose restart notification-api${NC}"
echo ""
echo "3. Verify the new client:"
echo "   ${BLUE}docker-compose logs -f notification-api | grep $CLIENT_ID${NC}"
echo ""
echo "4. Test with:"
echo "   ${BLUE}curl -X POST http://localhost:3000/notify \\
     -H 'Content-Type: application/json' \\
     -H 'X-Client-Id: $CLIENT_ID' \\
     -d '{\"service\":\"slack\",\"destination\":\"general\",\"message\":\"Test\"}'${NC}"
echo ""
print_info "For complete configuration examples, see ADD_NEW_CLIENT.md"
echo ""
