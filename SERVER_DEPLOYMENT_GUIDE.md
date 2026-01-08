# Universal Notification System - Server Deployment Guide

> **For DevOps Engineers**: Complete guide for first-time server setup and deployment

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Preparation](#server-preparation)
3. [Install Docker & Docker Compose](#install-docker--docker-compose)
4. [Clone & Configure Application](#clone--configure-application)
5. [Database Setup](#database-setup)
6. [Service Deployment](#service-deployment)
7. [Verification & Testing](#verification--testing)
8. [Production Considerations](#production-considerations)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Server Requirements

- **OS**: Ubuntu 20.04 LTS / 22.04 LTS (recommended) or CentOS 7+
- **RAM**: Minimum 4GB (8GB recommended for production)
- **CPU**: 2+ cores
- **Disk**: 20GB+ available space
- **Network**: Open ports 3000, 5432, 5672, 15672

### Required Access & Credentials

- [ ] SSH access to server with sudo privileges
- [ ] Slack Bot Token (for Slack notifications)
- [ ] AWS credentials (for Email/SMS via SES/SNS)
- [ ] Twilio credentials (for SMS via Twilio)
- [ ] Git access to repository

---

## Server Preparation

### Step 1: Connect to Server

```bash
# SSH into your server
ssh username@your-server-ip

# Update system packages
sudo apt update && sudo apt upgrade -y

# Install basic utilities
sudo apt install -y curl wget git vim ufw
```

### Step 2: Configure Firewall

```bash
# Allow SSH (if not already configured)
sudo ufw allow 22/tcp

# Allow application ports
sudo ufw allow 3000/tcp    # Notification API
sudo ufw allow 5672/tcp    # RabbitMQ AMQP
sudo ufw allow 15672/tcp   # RabbitMQ Management UI
sudo ufw allow 5432/tcp    # PostgreSQL (if external access needed)

# Enable firewall
sudo ufw --force enable

# Check status
sudo ufw status
```

### Step 3: Create Application User (Optional but Recommended)

```bash
# Create dedicated user for the application
sudo useradd -m -s /bin/bash notifier
sudo usermod -aG sudo notifier

# Switch to application user
sudo su - notifier
```

---

## Install Docker & Docker Compose

### Step 1: Install Docker

#### For Ubuntu/Debian:

```bash
# Remove old versions
sudo apt remove docker docker-engine docker.io containerd runc

# Install dependencies
sudo apt update
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add current user to docker group (logout/login required after this)
sudo usermod -aG docker $USER

# Verify installation
docker --version
docker compose version
```

#### For CentOS/RHEL:

```bash
# Install dependencies
sudo yum install -y yum-utils

# Add Docker repository
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Install Docker
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER

# Verify
docker --version
docker compose version
```

### Step 2: Configure Docker (Production Settings)

```bash
# Create Docker daemon configuration
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF

# Restart Docker to apply changes
sudo systemctl restart docker
```

### Step 3: Verify Docker Installation

```bash
# Test Docker
docker run hello-world

# Check Docker Compose
docker compose version
```

---

## Clone & Configure Application

### Step 1: Clone Repository

```bash
# Navigate to application directory
cd /opt  # or your preferred location
sudo mkdir -p /opt/apps
sudo chown -R $USER:$USER /opt/apps
cd /opt/apps

# Clone repository
git clone <your-repository-url> universal-notification
cd universal-notification

# Verify files
ls -la
```

### Step 2: Configure Environment Variables

```bash
# Copy sample environment file
cp env.sample .env

# Edit environment file
nano .env  # or vim .env
```

**Edit `.env` with your actual values:**

```bash
# Node Environment
NODE_ENV=production  # Use 'production' for production servers

# PostgreSQL Configuration
POSTGRES_DB=notifications_db
POSTGRES_USER=notifier_user        # Change from default 'user'
POSTGRES_PASSWORD=<strong-password> # CHANGE THIS!
POSTGRES_PORT=5433

# RabbitMQ Configuration
RABBITMQ_DEFAULT_USER=admin         # Change from default 'user'
RABBITMQ_DEFAULT_PASS=<strong-password> # CHANGE THIS!

# API Configuration
API_PORT=3000

# Slack Configuration (get from https://api.slack.com/apps)
SLACK_BOT_TOKEN=xoxb-your-actual-token-here

# AWS Configuration (for Email/SMS)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=your-s3-bucket-name

# Twilio Configuration (for SMS)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_FROM_NUMBER=your-twilio-phone-number
```

**⚠️ SECURITY NOTE:** 
- Never use default passwords in production
- Keep `.env` file secure (already in `.gitignore`)
- Use strong, unique passwords

### Step 3: Configure Client List

Edit `clientList.json` to configure your clients:

```bash
nano clientList.json
```

**Example configuration:**

```json
[
    {
        "ID": "PRODUCTION",
        "SERVER_PORT": 3001,
        "ENABLED_SERVERICES": ["slack", "email", "sms"],
        "SLACKBOT": {
            "TOKEN": "xoxb-your-production-slack-token",
            "RABBITMQ": {
                "EXCHANGE_NAME": "notifications_exchange",
                "EXCHANGE_TYPE": "direct",
                "QUEUE_NAME": "slackbot_queue",
                "ROUTING_KEY": "slack"
            }
        },
        "EMAIL": {
            "AWS": {
                "USER_NAME": "YourAWSUser",
                "PASSWORD": "YourAWSPassword",
                "SENDER_EMAIL": "noreply@yourdomain.com"
            },
            "RABBITMQ": {
                "EXCHANGE_NAME": "notifications_exchange",
                "EXCHANGE_TYPE": "direct",
                "QUEUE_NAME": "email_queue",
                "ROUTING_KEY": "email"
            }
        },
        "SMS": {
            "TEWILIO": {
                "ACCOUNT_SID": "YOUR_TWILIO_ACCOUNT_SID",
                "AUTH": "YOUR_TWILIO_AUTH_TOKEN",
                "FROM_NUMBER": "+1234567890"
            },
            "RABBITMQ": {
                "EXCHANGE_NAME": "notifications_exchange",
                "EXCHANGE_TYPE": "direct",
                "QUEUE_NAME": "sms_queue",
                "ROUTING_KEY": "sms"
            }
        },
        "DBCONFIG": {
            "HOST": "localhost",
            "PORT": 5433,
            "NAME": "notifications_db",
            "USER": "notifier_user",
            "PASSWORD": "your-db-password"
        },
        "RABBITMQ": {
            "HOST": "localhost",
            "PORT": 5672,
            "USER": "admin",
            "PASSWORD": "your-rabbitmq-password",
            "EXCHANGE_NAME": "notifications_exchange",
            "EXCHANGE_TYPE": "direct",
            "QUEUE_NAME": "notifications_queue",
            "ROUTING_KEY": "notifications"
        }
    }
]
```

**Note:** You can have multiple clients. Add more objects to the array for multi-tenant setup.

---

## Database Setup

### Step 1: Start PostgreSQL Container

```bash
# Start only PostgreSQL initially
docker compose up -d postgres

# Check PostgreSQL is running
docker compose ps postgres

# Wait for PostgreSQL to be ready (check logs)
docker compose logs -f postgres
# Press Ctrl+C when you see "database system is ready to accept connections"
```

### Step 2: Create Database Schemas

For each client in your `clientList.json`, create a schema:

```bash
# Get list of client IDs from clientList.json
# Example: PRODUCTION, STAGING, etc.

# Create schemas (replace with your actual client IDs)
# Schema names are lowercase versions of client IDs

cat <<'EOF' | docker compose exec -T postgres psql -U notifier_user -d notifications_db
-- Create schema for PRODUCTION client
CREATE SCHEMA IF NOT EXISTS production;

-- Create schema for STAGING client (if you have multiple)
CREATE SCHEMA IF NOT EXISTS staging;

-- Verify schemas created
\dn
EOF
```

### Step 3: Create Notification Tables

For each schema, create the notifications table:

```bash
# Create tables for all client schemas
cat <<'EOF' | docker compose exec -T postgres psql -U notifier_user -d notifications_db
-- Table for PRODUCTION schema
CREATE TABLE IF NOT EXISTS production.notifications (
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

-- Indexes for PRODUCTION
CREATE INDEX IF NOT EXISTS production_notifications_message_id ON production.notifications("messageId");
CREATE INDEX IF NOT EXISTS production_notifications_status ON production.notifications(status);
CREATE INDEX IF NOT EXISTS production_notifications_service_status ON production.notifications(service, status);
CREATE INDEX IF NOT EXISTS production_notifications_created_at ON production.notifications("createdAt");

-- Repeat for STAGING schema if needed
CREATE TABLE IF NOT EXISTS staging.notifications (
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

-- Indexes for STAGING
CREATE INDEX IF NOT EXISTS staging_notifications_message_id ON staging.notifications("messageId");
CREATE INDEX IF NOT EXISTS staging_notifications_status ON staging.notifications(status);
CREATE INDEX IF NOT EXISTS staging_notifications_service_status ON staging.notifications(service, status);
CREATE INDEX IF NOT EXISTS staging_notifications_created_at ON staging.notifications("createdAt");
EOF
```

### Step 4: Verify Database Setup

```bash
# List all schemas
docker compose exec postgres psql -U notifier_user -d notifications_db -c "\dn"

# List tables in each schema
docker compose exec postgres psql -U notifier_user -d notifications_db -c "\dt production.*"
docker compose exec postgres psql -U notifier_user -d notifications_db -c "\dt staging.*"

# Verify table structure
docker compose exec postgres psql -U notifier_user -d notifications_db -c "\d production.notifications"
```

### Step 5: Create Database Backup User (Optional but Recommended)

```bash
# Create read-only user for backups
cat <<'EOF' | docker compose exec -T postgres psql -U notifier_user -d notifications_db
CREATE USER backup_user WITH PASSWORD 'backup_password_here';
GRANT CONNECT ON DATABASE notifications_db TO backup_user;
GRANT USAGE ON SCHEMA production, staging TO backup_user;
GRANT SELECT ON ALL TABLES IN SCHEMA production, staging TO backup_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA production, staging GRANT SELECT ON TABLES TO backup_user;
EOF
```

---

## Service Deployment

### Step 1: Build Docker Images

```bash
# Build all images (this may take several minutes)
docker compose build --no-cache

# Verify images built
docker images | grep universal-notification
```

### Step 2: Start All Services

```bash
# Start all services in production mode
docker compose -f docker-compose.prod.yml up -d

# Or if using regular docker-compose.yml
# docker compose up -d

# Check all services are running
docker compose ps
```

Expected output:
```
NAME                       STATUS                    PORTS
notification_api_service   Up                        0.0.0.0:3000->3000/tcp
postgres_notifier          Up (healthy)              0.0.0.0:5433->5432/tcp
rabbitmq_notifier          Up (healthy)              0.0.0.0:5672->5672/tcp, 0.0.0.0:15672->15672/tcp
slack_connector_service    Up
email_connector_service    Up
sms_connector_service      Up
```

### Step 3: Monitor Service Startup

```bash
# Watch all logs
docker compose logs -f

# Watch specific service logs
docker compose logs -f notification-api
docker compose logs -f slack-connector

# Check for errors
docker compose logs | grep -i error
```

Look for these success messages:
```
notification_api_service  | Master: Loaded X clients.
notification_api_service  | Master router listening on port 3000
notification_api_service  | [PRODUCTION] Notification API listening on port 3001
rabbitmq_notifier         | Server startup complete
postgres_notifier         | database system is ready to accept connections
```

### Step 4: Verify Service Health

```bash
# Check container health
docker compose ps

# Check if API is responding
curl -I http://localhost:3000

# Check RabbitMQ Management UI
curl -I http://localhost:15672
```

---

## Verification & Testing

### Step 1: Test Notification API

```bash
# Test with a Slack notification
curl -X POST http://localhost:3000/notify \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: PRODUCTION" \
  -d '{
    "service": "slack",
    "destination": "general",
    "message": "Test notification from server deployment!"
  }'
```

**Expected Response:**
```json
{
  "status": "accepted",
  "message": "Notification request accepted and queued.",
  "messageId": "uuid-here"
}
```

### Step 2: Verify in RabbitMQ

```bash
# Access RabbitMQ Management UI
# Open browser: http://your-server-ip:15672
# Login: admin / your-rabbitmq-password

# Or check via CLI
docker compose exec rabbitmq rabbitmqctl list_queues
```

You should see queues: `slackbot_queue`, `email_queue`, `sms_queue`

### Step 3: Check Database Records

```bash
# Query notifications table
docker compose exec postgres psql -U notifier_user -d notifications_db -c "SELECT * FROM production.notifications ORDER BY \"createdAt\" DESC LIMIT 5;"
```

### Step 4: Test All Services

```bash
# Test Slack
curl -X POST http://localhost:3000/notify \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: PRODUCTION" \
  -d '{"service":"slack","destination":"general","message":"Slack test"}'

# Test Email
curl -X POST http://localhost:3000/notify \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: PRODUCTION" \
  -d '{
    "service":"email",
    "destination":"test@example.com",
    "subject":"Test Email",
    "body":"This is a test email",
    "fromEmail":"noreply@yourdomain.com"
  }'

# Test SMS
curl -X POST http://localhost:3000/notify \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: PRODUCTION" \
  -d '{
    "service":"sms",
    "destination":"+1234567890",
    "message":"Test SMS message"
  }'
```

### Step 5: Monitor Connector Logs

```bash
# Watch Slack connector process messages
docker compose logs -f slack-connector

# Watch Email connector
docker compose logs -f email-connector

# Watch SMS connector
docker compose logs -f sms-connector
```

---

## Production Considerations

### 1. Set Up Reverse Proxy (Nginx)

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/notification-api
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name notifications.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/notification-api /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### 2. Set Up SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d notifications.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### 3. Set Up Systemd Service (Auto-start on Boot)

```bash
# Create systemd service file
sudo nano /etc/systemd/system/universal-notification.service
```

Add:

```ini
[Unit]
Description=Universal Notification System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/apps/universal-notification
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
User=notifier

[Install]
WantedBy=multi-user.target
```

```bash
# Enable service
sudo systemctl daemon-reload
sudo systemctl enable universal-notification.service

# Test service
sudo systemctl start universal-notification
sudo systemctl status universal-notification
```

### 4. Configure Log Rotation

```bash
# Create log rotation configuration
sudo nano /etc/logrotate.d/universal-notification
```

Add:

```
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    size 10M
    missingok
    delaycompress
    copytruncate
}
```

### 5. Set Up Database Backups

```bash
# Create backup script
mkdir -p /opt/apps/universal-notification/backups
nano /opt/apps/universal-notification/backup-db.sh
```

Add:

```bash
#!/bin/bash
BACKUP_DIR="/opt/apps/universal-notification/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/notifications_db_$TIMESTAMP.sql"

# Create backup
docker compose exec -T postgres pg_dump -U notifier_user notifications_db > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

```bash
# Make executable
chmod +x /opt/apps/universal-notification/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add line:
0 2 * * * /opt/apps/universal-notification/backup-db.sh >> /opt/apps/universal-notification/backups/backup.log 2>&1
```

---

## Monitoring & Maintenance

### 1. Monitor Container Health

```bash
# Check running containers
docker compose ps

# Check resource usage
docker stats

# Check logs for errors
docker compose logs --tail=100 | grep -i error
```

### 2. Monitor Application Metrics

```bash
# Check API health
curl http://localhost:3000/health  # if health endpoint exists

# Monitor RabbitMQ
# Visit: http://your-server-ip:15672
# Check queue depths, message rates

# Monitor Database
docker compose exec postgres psql -U notifier_user -d notifications_db -c "
SELECT 
    schemaname,
    COUNT(*) as total_notifications,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'sent') as sent,
    COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM (
    SELECT 'production' as schemaname, status FROM production.notifications
    UNION ALL
    SELECT 'staging' as schemaname, status FROM staging.notifications
) t
GROUP BY schemaname;
"
```

### 3. Regular Maintenance Tasks

```bash
# Update Docker images (monthly or as needed)
cd /opt/apps/universal-notification
git pull
docker compose build --no-cache
docker compose -f docker-compose.prod.yml up -d

# Clean up unused Docker resources
docker system prune -a --volumes -f

# Rotate logs manually if needed
docker compose logs --tail=0 -f > /dev/null &
```

### 4. Set Up Monitoring Alerts

Consider integrating with:
- **Prometheus + Grafana** for metrics
- **ELK Stack** for log aggregation
- **Sentry** for error tracking
- **PagerDuty** or **OpsGenie** for alerts

---

## Troubleshooting

### Common Issues

#### 1. Services Won't Start

```bash
# Check Docker daemon
sudo systemctl status docker

# View detailed logs
docker compose logs

# Check for port conflicts
sudo netstat -tulpn | grep -E ':(3000|5432|5672|15672)'

# Recreate containers
docker compose down
docker compose up -d
```

#### 2. Database Connection Errors

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Test connection
docker compose exec postgres psql -U notifier_user -d notifications_db -c "SELECT 1;"

# Check credentials in .env match clientList.json
cat .env | grep POSTGRES
cat clientList.json | grep -A 5 DBCONFIG
```

#### 3. RabbitMQ Connection Issues

```bash
# Check RabbitMQ status
docker compose exec rabbitmq rabbitmqctl status

# Check queues
docker compose exec rabbitmq rabbitmqctl list_queues

# Restart RabbitMQ
docker compose restart rabbitmq
```

#### 4. Notifications Not Being Processed

```bash
# Check connector logs
docker compose logs slack-connector | tail -50
docker compose logs email-connector | tail -50
docker compose logs sms-connector | tail -50

# Verify messages in queue
# Visit: http://your-server-ip:15672

# Check database for pending notifications
docker compose exec postgres psql -U notifier_user -d notifications_db -c "
SELECT service, status, COUNT(*) 
FROM production.notifications 
WHERE \"createdAt\" > NOW() - INTERVAL '1 hour'
GROUP BY service, status;
"
```

#### 5. High Memory/CPU Usage

```bash
# Check resource usage
docker stats

# Restart specific service
docker compose restart notification-api

# Check for memory leaks in logs
docker compose logs | grep -i "memory\|heap"

# Limit container resources (edit docker-compose.yml)
# Add under each service:
#   deploy:
#     resources:
#       limits:
#         cpus: '0.5'
#         memory: 512M
```

### Getting Help

1. **Check logs first**: `docker compose logs -f`
2. **Review documentation**: All `.md` files in project
3. **Check GitHub issues**: Search for similar problems
4. **Enable debug logging**: Set `NODE_ENV=development` temporarily

---

## Quick Reference Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Restart specific service
docker compose restart notification-api

# View logs
docker compose logs -f

# Check status
docker compose ps

# Execute command in container
docker compose exec notification-api sh

# Database access
docker compose exec postgres psql -U notifier_user -d notifications_db

# Backup database
docker compose exec postgres pg_dump -U notifier_user notifications_db > backup.sql

# Update and redeploy
git pull
docker compose build
docker compose up -d
```

---

## Security Checklist

- [ ] Changed all default passwords
- [ ] Configured firewall rules
- [ ] Set up SSL/TLS for API
- [ ] Restricted database access
- [ ] Configured log rotation
- [ ] Set up database backups
- [ ] Limited container resources
- [ ] Configured proper file permissions
- [ ] Updated all packages
- [ ] Enabled Docker security options

---

## Post-Deployment

### 1. Document Your Setup

Create a local documentation file with:
- Server IP and credentials
- Client configurations
- Slack/AWS/Twilio tokens used
- Any custom configurations
- Backup schedule
- Monitoring setup

### 2. Team Handoff

Ensure team members have:
- Access to server
- Documentation
- RabbitMQ credentials
- Database access (if needed)
- Monitoring dashboard access

### 3. Schedule Review

- Weekly: Check logs and metrics
- Monthly: Review and update dependencies
- Quarterly: Security audit and backup restoration test

---

## Support

For issues or questions:
1. Check project documentation
2. Review logs: `docker compose logs -f`
3. Consult troubleshooting section
4. Open GitHub issue with details

---

**Deployment checklist completed? ✅**

Your Universal Notification System should now be fully operational!
