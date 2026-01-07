# Universal Notification System - Complete Setup Guide

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [Configuration](#configuration)
5. [Running the Application](#running-the-application)
6. [Testing the System](#testing-the-system)
7. [Troubleshooting](#troubleshooting)
8. [Additional Commands](#additional-commands)

---

## Overview

**Universal Notification** is a microservices-based notification system that supports multiple delivery channels (Slack, Email, SMS). It uses:
- **RabbitMQ** for message queuing
- **PostgreSQL** for data persistence
- **Docker** for containerization
- **AWS SES** for email delivery
- **AWS S3** for email templates
- **Slack API** for Slack notifications

### Architecture Components

1. **Notification API** - REST API to accept notification requests
2. **Slack Connector** - Processes and sends Slack messages
3. **Email Connector** - Processes and sends emails via AWS SES
4. **SMS Connector** - Processes and sends SMS messages
5. **RabbitMQ** - Message broker for asynchronous processing
6. **PostgreSQL** - Database for notification tracking

---

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

1. **Docker** (version 20.10 or higher)
   ```bash
   # Check Docker version
   docker --version
   ```

2. **Docker Compose** (version 2.0 or higher)
   ```bash
   # Check Docker Compose version
   docker-compose --version
   ```

3. **Git**
   ```bash
   # Check Git version
   git --version
   ```

### Required Accounts & Credentials

1. **AWS Account** (for Email connector)
   - AWS SES (Simple Email Service) access
   - AWS S3 bucket for email templates
   - AWS Access Key ID and Secret Access Key

2. **Slack Workspace** (for Slack connector)
   - Slack workspace with admin access
   - Slack Bot Token (starts with `xoxb-`)

---

## Initial Setup

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone <your-repository-url>

# Navigate to the project directory
cd universal-notification
```

### Step 2: Verify Project Structure

Ensure your project has the following structure:

```
universal-notification/
├── notification-api/
├── slack-connector/
├── email-connector/
├── sms-connector/
├── docker-compose.yml
├── env.sample
├── clientList.json
├── README.md
└── rabbitmq_data/
```

---

## Configuration

### Step 1: Create Environment File

Copy the sample environment file:

```bash
# Create .env file from sample
cp env.sample .env
```

### Step 2: Configure Environment Variables

Edit the `.env` file with your specific configuration:

```bash
# Open .env file in your preferred editor
nano .env
# or
vim .env
# or
code .env
```

#### Basic Configuration

```env
# Node Environment
NODE_ENV=development

# PostgreSQL Database Configuration
POSTGRES_DB=notifications_db
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_PORT=5432

# RabbitMQ Configuration
RABBITMQ_DEFAULT_USER=user
RABBITMQ_DEFAULT_PASS=password

# API Configuration
API_PORT=3000
```

#### Slack Configuration

**To get your Slack Bot Token:**

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"** → **"From scratch"**
3. Enter an App Name (e.g., "Notification Bot") and select your workspace
4. Navigate to **"OAuth & Permissions"** from the sidebar
5. Under **"Bot Token Scopes"**, add the following scopes:
   - `chat:write`
   - `chat:write.public` (if sending to channels without joining)
6. Click **"Install to Workspace"** at the top
7. Copy the **"Bot User OAuth Token"** (starts with `xoxb-`)
8. Add to your `.env` file:

```env
# Slack Connector Configuration
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token-here
```

9. **Important:** Add the bot to the channels where you want to send messages:
   - Go to the Slack channel
   - Click the channel name → **"Integrations"** → **"Add apps"**
   - Select your bot

#### AWS Configuration (for Email/SMS Connectors)

**To configure AWS:**

1. **Install AWS CLI** (if not already installed):
   ```bash
   # macOS
   brew install awscli
   
   # OR using pip
   pip install awscli
   ```

2. **Configure AWS credentials:**
   ```bash
   # Run AWS configure
   aws configure
   ```
   
   Enter the following when prompted:
   - AWS Access Key ID: `[Your AWS Access Key]`
   - AWS Secret Access Key: `[Your AWS Secret Key]`
   - Default region name: `us-east-1` (or your preferred region)
   - Default output format: `json`

3. **Add to `.env` file:**
   ```env
   # AWS Configuration
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your-email-templates-bucket-name
   ```

4. **Set up AWS SES:**
   - Go to AWS Console → SES
   - Verify your sender email address
   - If in sandbox mode, verify recipient emails too
   - Request production access if needed

5. **Create S3 Bucket for Email Templates:**
   ```bash
   # Create S3 bucket
   aws s3 mb s3://your-email-templates-bucket-name --region us-east-1
   
   # Upload sample template
   aws s3 cp sample_email_template.html s3://your-email-templates-bucket-name/templates/sample.html
   ```

---

## Running the Application

### Step 1: Build Docker Images

Build all the Docker images for the services:

```bash
# Build all services
docker-compose build
```

This command will:
- Build the Notification API image
- Build the Slack Connector image
- Build the Email Connector image
- Build the SMS Connector image

### Step 2: Start All Services

Start all services in detached mode:

```bash
# Start all services
docker-compose up -d
```

**What this does:**
- Starts RabbitMQ (ports 5672, 15672)
- Starts PostgreSQL (port 5432)
- Starts Notification API (port 3000)
- Starts Slack Connector
- Starts Email Connector
- Starts SMS Connector
- Runs database migrations automatically

### Step 3: Verify Services are Running

Check the status of all containers:

```bash
# List running containers
docker-compose ps
```

You should see all services with status `Up`:
```
NAME                        STATUS
notification_api_service    Up
slack_connector_service     Up
email_connector_service     Up
sms_connector_service       Up
rabbitmq_notifier          Up (healthy)
postgres_notifier          Up (healthy)
```

### Step 4: Check Service Logs

View logs to ensure services started correctly:

```bash
# View all logs
docker-compose logs

# View logs for specific service
docker-compose logs notification-api
docker-compose logs slack-connector
docker-compose logs email-connector
docker-compose logs sms-connector

# Follow logs in real-time
docker-compose logs -f
```

### Step 5: Access RabbitMQ Management UI

Open your browser and navigate to:
```
http://localhost:15672
```

**Login credentials:**
- Username: `user`
- Password: `password`

You should see:
- Exchange: `notifications_exchange`
- Queues: `slack_queue`, `email_queue`, `sms_queue`

---

## Testing the System

### Test 1: Health Check

Verify the Notification API is running:

```bash
# Simple health check
curl http://localhost:3000
```

### Test 2: Send a Slack Notification

```bash
# Send a test Slack message
curl -X POST http://localhost:3000/notify \
  -H "Content-Type: application/json" \
  -d '{
    "service": "slack",
    "channel": "#general",
    "message": "Hello from Universal Notification System! 🚀"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "notificationId": "uuid-here",
  "message": "Notification queued successfully"
}
```

**Verify:**
1. Check your Slack channel for the message
2. Check RabbitMQ UI for queue activity
3. Check logs: `docker-compose logs slack-connector`

### Test 3: Send an Email Notification

```bash
# Send a test email
curl -X POST http://localhost:3000/notify \
  -H "Content-Type: application/json" \
  -d '{
    "service": "email",
    "to": "recipient@example.com",
    "from": "sender@example.com",
    "subject": "Test Email",
    "templateId": "sample",
    "data": {
      "name": "John Doe",
      "content": "This is a test email from Universal Notification System"
    }
  }'
```

**Verify:**
1. Check recipient email inbox
2. Check AWS SES console for sent emails
3. Check logs: `docker-compose logs email-connector`

### Test 4: Send an SMS Notification

```bash
# Send a test SMS
curl -X POST http://localhost:3000/notify \
  -H "Content-Type: application/json" \
  -d '{
    "service": "sms",
    "to": "+1234567890",
    "message": "Test SMS from Universal Notification System"
  }'
```

### Test 5: Check Database Records

Connect to PostgreSQL to view notification records:

```bash
# Connect to PostgreSQL container
docker exec -it postgres_notifier psql -U user -d notifications_db

# List all notifications
SELECT * FROM notifications;

# Exit PostgreSQL
\q
```

---

## Troubleshooting

### Issue 1: Services Won't Start

**Problem:** Containers fail to start or exit immediately.

**Solution:**
```bash
# Check detailed logs
docker-compose logs [service-name]

# Check if ports are already in use
lsof -i :3000  # Check API port
lsof -i :5432  # Check PostgreSQL port
lsof -i :5672  # Check RabbitMQ port

# Stop conflicting services or change ports in .env
```

### Issue 2: Database Connection Errors

**Problem:** Services can't connect to PostgreSQL.

**Solution:**
```bash
# Check PostgreSQL is healthy
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres

# Wait for health check
docker-compose ps
```

### Issue 3: RabbitMQ Connection Errors

**Problem:** Services can't connect to RabbitMQ.

**Solution:**
```bash
# Check RabbitMQ is healthy
docker-compose ps rabbitmq

# Check RabbitMQ logs
docker-compose logs rabbitmq

# Access RabbitMQ container
docker exec -it rabbitmq_notifier rabbitmqctl status

# Restart RabbitMQ
docker-compose restart rabbitmq
```

### Issue 4: Slack Messages Not Sending

**Problem:** Slack connector processes messages but doesn't deliver.

**Solutions:**

1. **Verify Bot Token:**
   ```bash
   # Check if token is set
   docker exec slack_connector_service env | grep SLACK_BOT_TOKEN
   ```

2. **Verify Bot Permissions:**
   - Ensure bot has `chat:write` scope
   - Ensure bot is added to the target channel

3. **Check Logs:**
   ```bash
   docker-compose logs slack-connector
   ```

### Issue 5: Email Not Sending

**Problem:** Email connector processes messages but doesn't deliver.

**Solutions:**

1. **Verify AWS Credentials:**
   ```bash
   # Check AWS CLI configuration
   aws sts get-caller-identity
   ```

2. **Verify SES Configuration:**
   - Check sender email is verified in SES
   - Check recipient email is verified (if in sandbox mode)
   - Check SES sending limits

3. **Check S3 Template:**
   ```bash
   # Verify template exists
   aws s3 ls s3://your-bucket-name/templates/
   ```

4. **Check Logs:**
   ```bash
   docker-compose logs email-connector
   ```

### Issue 6: Permission Denied Errors

**Problem:** Permission errors with volumes or files.

**Solution:**
```bash
# Fix permissions on rabbitmq_data
sudo chmod -R 777 rabbitmq_data/

# Or recreate with proper permissions
sudo rm -rf rabbitmq_data/
mkdir rabbitmq_data
```

---

## Additional Commands

### Managing Services

```bash
# Stop all services
docker-compose down

# Stop and remove all data (including database)
docker-compose down -v

# Restart specific service
docker-compose restart notification-api

# Rebuild and restart a service
docker-compose up -d --build notification-api

# Scale a connector (e.g., run 3 slack connectors)
docker-compose up -d --scale slack-connector=3
```

### Viewing Logs

```bash
# View last 100 lines of logs
docker-compose logs --tail=100

# Follow logs for specific service
docker-compose logs -f notification-api

# View logs with timestamps
docker-compose logs -t

# View logs for multiple services
docker-compose logs slack-connector email-connector
```

### Database Management

```bash
# Access PostgreSQL CLI
docker exec -it postgres_notifier psql -U user -d notifications_db

# Create a database backup
docker exec postgres_notifier pg_dump -U user notifications_db > backup.sql

# Restore from backup
docker exec -i postgres_notifier psql -U user -d notifications_db < backup.sql

# Run migrations manually
docker exec notification_api_service npx sequelize-cli db:migrate

# Rollback migration
docker exec notification_api_service npx sequelize-cli db:migrate:undo
```

### RabbitMQ Management

```bash
# Access RabbitMQ CLI
docker exec -it rabbitmq_notifier rabbitmqctl

# List queues
docker exec rabbitmq_notifier rabbitmqctl list_queues

# List exchanges
docker exec rabbitmq_notifier rabbitmqctl list_exchanges

# List bindings
docker exec rabbitmq_notifier rabbitmqctl list_bindings

# Purge a queue
docker exec rabbitmq_notifier rabbitmqctl purge_queue slack_queue
```

### Development Commands

```bash
# Install dependencies in a service
docker exec notification_api_service npm install

# Run tests
docker exec notification_api_service npm test

# Access container shell
docker exec -it notification_api_service sh

# View container resource usage
docker stats

# Clean up unused Docker resources
docker system prune -a
```

### Monitoring

```bash
# Watch service logs in real-time
docker-compose logs -f --tail=50

# Monitor container resource usage
docker stats

# Check container health
docker inspect --format='{{.State.Health.Status}}' postgres_notifier
docker inspect --format='{{.State.Health.Status}}' rabbitmq_notifier
```

---

## Production Deployment Considerations

### Security

1. **Change Default Credentials:**
   ```env
   # Use strong passwords
   POSTGRES_PASSWORD=<strong-password>
   RABBITMQ_DEFAULT_PASS=<strong-password>
   ```

2. **Use Docker Secrets:**
   - Don't store sensitive data in `.env`
   - Use Docker secrets or environment-specific secret management

3. **Limit Port Exposure:**
   - Don't expose database/RabbitMQ ports publicly
   - Use reverse proxy for API

### Performance

1. **Use Production Node Environment:**
   ```env
   NODE_ENV=production
   ```

2. **Optimize Database:**
   - Add proper indexes
   - Configure connection pooling

3. **Scale Connectors:**
   ```bash
   # Run multiple connector instances
   docker-compose up -d --scale slack-connector=3
   ```

### Monitoring

1. **Add Logging Service:**
   - Implement centralized logging (ELK, CloudWatch)

2. **Add Metrics:**
   - Monitor queue lengths
   - Track notification delivery rates
   - Monitor error rates

3. **Set Up Alerts:**
   - Alert on service failures
   - Alert on queue backlog
   - Alert on database connection issues

---

## Quick Reference

### Common Commands Cheat Sheet

```bash
# Start everything
docker-compose up -d

# Stop everything
docker-compose down

# View logs
docker-compose logs -f

# Restart a service
docker-compose restart [service-name]

# Rebuild a service
docker-compose up -d --build [service-name]

# Check status
docker-compose ps

# Send test notification
curl -X POST http://localhost:3000/notify \
  -H "Content-Type: application/json" \
  -d '{"service": "slack", "channel": "#general", "message": "Test"}'
```

### Service URLs

- **Notification API:** `http://localhost:3000`
- **RabbitMQ Management:** `http://localhost:15672` (user/password)
- **PostgreSQL:** `localhost:5432` (user/password)

---

## Getting Help

If you encounter issues not covered in this guide:

1. Check service logs: `docker-compose logs [service-name]`
2. Check RabbitMQ UI for queue/exchange status
3. Verify all environment variables are set correctly
4. Ensure all external services (AWS, Slack) are configured properly
5. Check the project's GitHub issues or documentation

---

## Next Steps

After successful setup:

1. **Customize Email Templates:** Create and upload custom email templates to S3
2. **Configure Multiple Clients:** Edit `clientList.json` for multi-tenant support
3. **Set Up Monitoring:** Implement application monitoring and alerting
4. **Add Authentication:** Secure the API with authentication/authorization
5. **Create Additional Connectors:** Extend the system with more notification channels

---

**Last Updated:** January 2026
