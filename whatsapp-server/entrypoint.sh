#!/bin/sh
set -e

SERVICE_NAME="$1"

echo "=============================="
echo " NODE SERVICE ENTRYPOINT"
echo " Service Arg : ${SERVICE_NAME}"
echo " Env         : ${NODE_ENV}"
echo "=============================="

if [ -z "$SERVICE_NAME" ]; then
  echo "❌ No service name provided"
  echo "Usage: <api|slack|email|sms|whatsapp>"
  exit 1
fi

# Dev vs Prod runner
if [ "$NODE_ENV" = "development" ]; then
  echo "🚧 Development mode"
  npm install -g nodemon
  RUNNER="nodemon"
else
  echo "🚀 Production mode"
  RUNNER="node"
fi

# Run migrations only for API
if [ "$SERVICE_NAME" = "api" ]; then
  echo "🔄 Running DB migrations..."
  npm run migrate
fi

# Switch based on argument
case "$SERVICE_NAME" in
  api)
    echo "▶ Starting Notification API"
    exec $RUNNER src/server.js
    ;;
  slack)
    echo "▶ Starting Slack Connector"
    exec $RUNNER src/index.js
    ;;
  email)
    echo "▶ Starting Email Connector"
    exec $RUNNER src/index.js
    ;;
  sms)
    echo "▶ Starting SMS Connector"
    exec $RUNNER src/index.js
    ;;
  whatsapp)
    echo "▶ Starting WhatsApp Connector"
    exec $RUNNER src/index.js
    ;;
  *)
    echo "❌ Unknown service: $SERVICE_NAME"
    exit 1
    ;;
esac
