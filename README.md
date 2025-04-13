
# universal-notification

## Project Description

This project, **Universal Notification**, is a microservices-based system designed to facilitate sending notifications across multiple channels (currently supporting Slack, with future expansion planned). It decouples notification requests from their delivery, providing a unified interface for applications to send messages without worrying about the specifics of each notification service.

## Modules

The project consists of the following modules:

1.  **Notification API**:
    *   Exposes an HTTP API (`/notify`) to accept notification requests.
    *   Validates requests and queues them for delivery via RabbitMQ.
    *   Manages the lifecycle of notification records in a database.

2.  **Slack Connector**:
    *   Consumes notification requests from a RabbitMQ queue.
    *   Processes messages and sends them to Slack.
    *   Updates the notification status in the database.

## Installation Instructions

### Prerequisites

*   Docker and Docker Compose

### Steps

1.  **Clone the repository:**
    


```
curl -X POST http://localhost:3000/notify \
     -H "Content-Type: application/json" \
     -d '{
           "service": "email",
           "channel": "#devops-internal", // The app in slack has to be added to the channel 
           "message": "Message to be published"
         }'
```