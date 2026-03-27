
# Universal Notification System

## 📋 Project Description

**Universal Notification** is a microservices-based system for sending notifications across multiple channels — Slack, Email, SMS, and WhatsApp. It decouples notification requests from their delivery via a RabbitMQ message queue, providing a unified API for all notification types.

**Key Features:**
- Multi-tenant architecture (multiple clients per deployment)
- V1 and V2 notification APIs
- Template management (create, list, update, delete)
- Routing rules engine (per-client, per-service provider routing)
- Webhook delivery callbacks with retry support
- Provider balance monitoring
- Swagger UI at `/api-docs`
- RabbitMQ-based async delivery
- PostgreSQL notification tracking & delivery status
- Docker-ready with complete containerization

---

## 🏗️ Architecture

```
Client Request
     │
     ▼
┌─────────────────────────┐
│     Notification API    │  ← HTTP REST + Swagger UI
│  (Multi-tenant master   │
│   + per-client workers) │
└────────────┬────────────┘
             │ RabbitMQ (topic exchange)
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌──────────┐   ┌─────────────────┐
│  slack-  │   │  email-         │
│ connector│   │  connector      │
└──────────┘   └─────────────────┘
    ▼                 ▼
┌──────────┐   ┌─────────────────┐
│   sms-   │   │  whatsapp-      │
│ connector│   │  server         │
└──────────┘   └─────────────────┘
                      │
               webhook-server (gRPC + cron)
```

### Modules

| Module | Description |
|--------|-------------|
| `notification-api` | Core HTTP API — accepts requests, validates, queues via RabbitMQ, tracks status |
| `slack-connector` | Consumes Slack queue, delivers messages via Slack Bot API |
| `email-connector` | Consumes Email queue, renders templates, delivers via AWS SES |
| `sms-connector` | Consumes SMS queue, delivers via configurable SMS providers |
| `whatsapp-server` | Consumes WhatsApp queue, delivers via WhatsApp provider |
| `webhook-server` | Delivers webhook callbacks to client-configured URLs, with retry logic (cron-based) |

---

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
docker-compose logs -f notification-api
```

### Using npm (Local Development)

```bash
cd notification-api
npm install
npm run migrate   # run DB migrations
npm start
```

---

## 📡 API Endpoints

All requests require the `X-Client-Id` header. Protected endpoints also require a `Bearer` token via `Authorization` header.

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/login` | Login and receive access + refresh tokens |
| POST | `/refresh` | Refresh an expired access token |
| POST | `/logout` | Invalidate the current session |

### Notifications
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/notify` | ✅ | Send a notification (SMS / Email / Slack / WhatsApp) |
| POST | `/v2/notify` | ✅ | Send multi-service notifications in one request (V2) |
| POST | `/notify-with-attachment` | ❌ | Publish a queued notification with S3 attachment |

### Templates
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/templates` | ✅ | Create a new message template |
| GET | `/templates` | ✅ | List / search templates |
| PUT | `/templates/:id` | ✅ | Update a template |
| DELETE | `/templates/:id` | ✅ | Delete a template |

### Routing Rules
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/routing-rules` | ✅ | Create a routing rule |
| GET | `/routing-rules` | ✅ | List routing rules |
| PUT | `/routing-rules/:ruleId` | ✅ | Update a routing rule |
| DELETE | `/routing-rules/:ruleId` | ✅ | Delete a routing rule |

### Webhooks
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/webhooks` | ✅ | Register a webhook configuration |
| GET | `/webhooks` | ✅ | List webhook configurations |
| PATCH | `/webhooks/:webhookId` | ✅ | Update a webhook configuration |
| DELETE | `/webhooks/:webhookId` | ✅ | Delete a webhook configuration |
| GET | `/webhooks/logs` | ✅ | List webhook delivery logs |

### Logs & Status
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/delivery-status/:id` | ✅ | Get delivery status of a notification |
| GET | `/logs` | ✅ | Get notification logs (paginated, filterable) |
| GET | `/slack-logs` | ✅ | Get Slack-specific logs with reply details |

### Balance
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/balance` | ✅ | Get real-time provider balance |
| POST | `/refresh-balance` | ✅ | Force-refresh cached provider balance |

> 📖 **Full API documentation** available at `/api-docs` (Swagger UI) when the server is running.

---

## 📝 Usage Examples

### Login
```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: YOUR_CLIENT_ID" \
  -d '{"username": "admin", "password": "secret"}'
```

### Send a Notification (V1)
```bash
curl -X POST http://localhost:3000/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -H "X-Client-Id: YOUR_CLIENT_ID" \
  -d '{"service": "slack", "destination": "C08Q1239E10R", "message": "Hello from Universal Notification!"}'
```

### Send Multi-Service Notifications (V2)
```bash
curl -X POST http://localhost:3000/v2/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -H "X-Client-Id: YOUR_CLIENT_ID" \
  -d '{
    "commonMessage": "System alert!",
    "sms": [{"destination": "+919929797900"}],
    "slack": [{"destination": "C08Q1239E10R"}]
  }'
```

---

## 🌐 Service Ports (Docker)

| Service | Host Port | Description |
|---------|-----------|-------------|
| Notification API | `3000` (default, via `API_PORT`) | Main HTTP API + Swagger UI |
| RabbitMQ AMQP | `5673` | AMQP messaging port |
| RabbitMQ UI | `15672` | Queue management dashboard |
| PostgreSQL | `5434` (default, via `POSTGRES_PORT`) | Database |

---

## 🔧 Prerequisites

- **Docker** and **Docker Compose** (recommended)
- **Node.js** 18+ (for local development)
- **PostgreSQL** 15+
- **RabbitMQ** 3.11+
- **AWS Account** (S3 + SES for Email connector)
- **Slack Workspace** (for Slack connector)

---

## 🆕 Adding New Clients

Use the automated script:
```bash
./add_client.sh NEWCLIENT 3003
```
Then update `clientList.json` and restart the notification-api service.

---

## 📚 Documentation

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** — Complete local and Docker setup instructions
- **[SERVER_DEPLOYMENT_GUIDE.md](./SERVER_DEPLOYMENT_GUIDE.md)** — Production server deployment guide
- **[HLD.md](./HLD.md)** — High-level system design document

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes and test thoroughly
4. Submit a pull request

---

## 📄 License

ISC