• Order --> Inventory (sync comm)
• Order service will make a request to Notification Service and will not wait for the response.
• This type of communication is called Async communication.
• Async communication can be enabled using Event driven architecture.
• i.e performing async communication in the form of events.
• So whenever we receive an order to order microservice and the order is placed successfully.
• The order microservice will raise an event like "OrderPlacedEvent" , we can add this event to a queue in Kafka or any messaging system.
• The consumer, here the Notification Service will consume the message and process the message accordingly.

Setup:
docker compose up -d
docker ps
docker logs -f broker
Configure kafka in order service

Spring for Apache Kafka.

	
