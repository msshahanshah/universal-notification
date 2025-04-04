# universal-notification



```
curl -X POST http://localhost:3000/notify \
     -H "Content-Type: application/json" \
     -d '{
           "service": "email",
           "channel": "#devops-internal", // The app in slack has to be added to the channel 
           "message": "Message to be published"
         }'
```