
# Universal Notification System

## 📋 Project Description

This project, **Universal Notification**, is a microservices-based system designed to facilitate sending notifications across multiple channels (Slack, Email, SMS). It decouples notification requests from their delivery, providing a unified interface for applications to send messages without worrying about the specifics of each notification service.

**Key Features:**
- Multi-tenant architecture (support for multiple clients)
- Database tracking for all notifications
- RabbitMQ-based message queue system
- Support for Slack, Email (AWS SES), and SMS (Twilio)
- Docker-ready with complete containerization

## 🏗️ Architecture

The project consists of the following modules:

1.  **Notification API**:
    *   Exposes an HTTP API (`/notify`) to accept notification requests
    *   Validates requests and queues them for delivery via RabbitMQ
    *   Manages the lifecycle of notification records in a database
    *   Multi-tenant support with client-based routing

2.  **Slack Connector**:
    *   Consumes notification requests from a RabbitMQ queue
    *   Processes messages and sends them to Slack
    *   Updates the notification status in the database

3.  **Email Connector**:
    * Consumes notification requests from a RabbitMQ queue
    * Retrieves email templates from AWS S3 based on the `templateId`
    * Renders the email template with the provided data
    * Sends the rendered email via AWS SES
    * Updates the notification status in the database

4.  **SMS Connector**:
    * Consumes notification requests from a RabbitMQ queue
    * Sends SMS messages via Twilio
    * Updates the notification status in the database

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# 1. Configure environment
cp env.sample .env
# Edit .env with your credentials

# 2. Start all services
docker-compose up -d

# 3. Check status
docker-compose ps

# 4. View logs
docker-compose logs -f
```

### Using npm (Local Development)

```bash
# Start notification API
cd notification-api
npm install
npm start
```

## 📝 Usage Example

Send a notification:

```bash
curl -X POST http://localhost:3000/notify \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: GKMIT" \
  -d '{
    "service": "slack",
    "destination": "general",
    "message": "Hello from Universal Notification!"
  }'
```

Response:
```json
{
  "status": "accepted",
  "message": "Notification request accepted and queued.",
  "messageId": "uuid-here"
}
```

## 📚 Documentation

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Complete setup instructions
- **[DOCKER.md](./DOCKER.md)** - Docker setup and deployment guide
- **[DOCKER_QUICK_REF.md](./DOCKER_QUICK_REF.md)** - Docker command reference
- **[ADD_NEW_CLIENT.md](./ADD_NEW_CLIENT.md)** - How to add new clients
- **[ADD_CLIENT_QUICK.md](./ADD_CLIENT_QUICK.md)** - Quick client addition guide
- **[HLD.md](./HLD.md)** - High-level design document

## 🔧 Prerequisites

*   **Docker** and **Docker Compose** (recommended)
*   **Node.js** 18+ (for local development)
*   **PostgreSQL** 15+
*   **RabbitMQ** 3.11+
*   **AWS Account** (for Email/SMS connectors)
*   **Slack Workspace** (for Slack connector)

## 🆕 Adding New Clients

Use the automated script:

```bash
./add_client.sh NEWCLIENT 3003
```

Then update `clientList.json` and restart services. See [ADD_NEW_CLIENT.md](./ADD_NEW_CLIENT.md) for details.

## 🌐 Service Endpoints

| Service | Port | Description |
|---------|------|-------------|
| Notification API | 3000 | Main HTTP API |
| RabbitMQ UI | 15672 | Queue management |
| PostgreSQL | 5433 | Database |

## 🤝 Contributing

1. Clone the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

ISC