API GATEWAY:

- It is an entry point for all the requests into the application.
- It is basically used for forwarding the requests to the downstream microservices.
- It is one of the most commonly used component in the distributed system or microservices architecture.
- Current Product microservice is running on port 8080, in local development it is fine but not in production.
- At any point of time, there can be changes to this product-service.Imagine we want to create a new Microservice from Product Service like Product Promotion Service, the client(UI) needs to change the URL manually.
- Even for scalability constraint we will have multiple instances of the same service of the Application.
- If one of the instance of the product service goes down, if we hard code the url of the service in the client side then the client cannot access the product service any more. It is not acceptable situation.
1. Kong API GATEWAY (AUTHENTICATION AND AUTHORIZATION LOGGING)

2.SPRING CLOUD API GATEWAY

@RequestMapping("/api/product")

ProductController{

@GetMapping("/productDetails")

@PutMapping("/update")

}

Rate Limiting:

Internet banking -otp: send otp : 3 - your quota has been ddos attacks

Chatbots - 1000 service may down , the real users which causes bad user experience. 1 min - 3 times.

8080/api/products/getDetails -

9000/api/products/getDetails

9000/api/invent

9000/api/

Dependency: spring-cloud-starter-gateway-mvc

Person(id,name,age,salary)

Person().setId(1).setId(10).build();

9002/api/inventory/createInventory