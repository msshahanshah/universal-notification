
# universal-notification

## Project Description

This project, **Universal Notification**, is a microservices-based system designed to facilitate sending notifications across multiple channels (currently supporting Slack, with future expansion planned). It decouples notification requests from their delivery, providing a unified interface for applications to send messages without worrying about the specifics of each notification service.
It uses a database to keep track of the notifications, and rabbitMq to communicate between the different services.

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
3.  **Email Connector**:
    * Consumes notification requests from a RabbitMQ queue.
    * Retrieves email templates from AWS S3 based on the `templateId` in the message.
    * Renders the email template with the provided data.
    * Sends the rendered email via AWS SES.
    * Updates the notification status in the database.

## Installation Instructions

### Prerequisites

*   **Docker** and **Docker Compose**: You need to have Docker and Docker Compose installed on your machine.
*   **AWS Account**: For the Email Connector, you'll need an AWS account with access to SES and S3.
* **Slack workspace**: For the Slack Connector, you'll need a Slack workspace and a bot token with the necessary permissions.
* **AWS config**: Set up the AWS CLI locally to configure the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`


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