## What is fault Tolerance?

*Fault tolerance is the property that enables a system to continue operating properly in the event of the failure of some of its components.

* Hystrix provides Fault Tolerance by :
* Stop cascading failures. Fallbacks and graceful degradation.

* We’ll use the library and implement the Circuit Breaker design pattern, which is describing a strategy against failure cascading or fault tolerance at different levels in an application.

* Hystrix is watching methods for failing calls to related services. If there is such a failure, it will open the circuit and forward the call to a fallback method.

* Hystrix circuit Breaker will tolerate failures up to a threshold. Beyond that, it leaves the circuit open. Which means, it will forward all subsequent calls to the fallback method, to prevent future failures. This creates a time buffer for the related service to recover from its failing state.

## Circuit Breaker Design Pattern

*Idea behind circuit breaker is :
* Wrap your rest api call in circuit breaker object which monitors for failure
* Once the failures reach a certain threshold, the circuit breaker trips, and all further calls to the circuit breaker return with an error,
* Here comes our task: If it fails and circuit is open, configure a fallback method which will be executed as soon as circuit breaks or opens.
* In this way, your vaccination center service Rest controller is wrapped with a proxy class and monitor its calls. Everything is done internally handles everything for you in hystrix

@HystrixCommand Elements
* fallbackMethod : Specifies a method to process fallback logic
* threadPoolKey : The thread-pool key is used to represent a HystrixThreadPool for monitoring, metrics publishing, caching and other such uses.
* threadPoolProperties: Specifies thread pool properties.
* groupKey: The command group key is used for grouping together commands such as for reporting, alerting, dashboards or team/library ownership

* A typical distributed system consists of many services collaborating together.

* These services are prone to failure or delayed responses. If a service fails it may impact on other services affecting performance and possibly making other parts of application inaccessible or in the worst case bring down the whole application.

* Of course, there are solutions available that help make applications resilient and fault tolerant – one such framework is Hystrix circuit breaker.

* The Hystrix circuit breaker framework library helps to control the interaction between services by providing fault tolerance and latency tolerance. It improves overall resilience of the system by isolating the failing services and stopping the cascading effect of failures.
