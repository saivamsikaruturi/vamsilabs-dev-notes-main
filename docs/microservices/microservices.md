<div style="display: flex; align-items: center;">
  <p>MicroServices</p>
  <img src="Picture3.png" alt="Picture3.png" />
</div>

![Picture2.png](Picture2.png)

![Untitled.png](Untitled.png)

# What Is Monolithic Application?

- In Monolithic the application is build as a single
- Such application comprises of client-side interface , server-side interface and a
- Normally a monolithic application have one large code and it lack

# Disadvantages Of Monolithic

- The code base get larger in size with time and hence it’s very difficult to
- It is very difficult to introduce new technology as it affects the whole
- A single bug in any module can bring down the whole
- It is very difficult to scale a single
- Continuous deployment is extremely Large monolithic applications are actually an obstacle to frequent deployments. In order to update one component , we have to redeploy the entire application.

## What Are Microservices?

While Monolithic Applications work as a single component , a MicroService Architecture breaks it down to independent standalone small applications , each serving one particular requirement .

Eg: 1 Micro service for handling product details and other service like user details ,

payment and inventory.

Within this microservice architecture, the entire functionality is split in independent

deployable module which communicate each other through Restful Web Services.

# COMPONENTS

- Service Discovery
- API GATEWAY
- Spring Cloud Config Server
- Hystrix Circuit Breaker
- Zipkin and Sleuth
- Ribbon