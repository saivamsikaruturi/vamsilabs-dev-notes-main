* Command & Query Responsibility Segregation:
* i.e Segregate query responsibility which is nothing but read operation and command responsibility which is write operation.
* CQRS suggests us to segregate read and write operation to different microservices rather than mix up in a single service.

* Why do I duplicate the service to just serve different responsibility ??
* For an example, we are using Flipkart/Amazon ecommerce application, so there will be many read /search requests than write / add to cart requests.
* We can't scale the application independently for read and write request.
* Writing Complex Queries.x
* Additional Security 

Query 
/GET - Fetch Products 

Command
/POST - Create Products
/PUT - Update Products
/DELETE - Delete Products

![cqrs.PNG][cqrs.PNG]

* In order to sync both the micro-services to avoid data inconsistency we can use any messaging system like kafka, RabbitMQ or Redis PubSub