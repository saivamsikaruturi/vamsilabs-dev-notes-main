**Caching**

* Caching is a technique to store frequently used data in a fast access memory rather than accessing data every time from slow access memory.
* This makes our system fast.
* It helps to reduce the latency.
* It also helps to achieve the fault tolerance.

* There are different types of caching present at different layer of the system Like:
- Client Side Caching (browser caching)
- CDN (used to store static data)
- Load Balancer
- Server side Application Caching (like Redis etc)

![caching.PNG](caching.PNG)

**What is distributed Caching??**
![ds.PNG](ds.PNG)
- scalability i.e limited space /resources.
- single point of failure.

Caching Strategy

1. Caching Aside
* Application first check the cache.
* If data found in Cache, it's called Cache Hit and data is returned to the client.
* If data is not found in Cache, its called Cache Miss.Application fetch the data from DB , store it back to Cache and data is return back to the client.

![cs1.PNG](cs1.PNG)

2. Read through Cache

![cs2.PNG](cs2.PNG)

3. Write Around Cache.

![cs3.PNG](cs3.PNG)

4. Write through Cache

![cs-4.PNG](cs-4.PNG)


5. Write Back (or Behind) Cache.

![cs-5.PNG](cs-5.PNG)


