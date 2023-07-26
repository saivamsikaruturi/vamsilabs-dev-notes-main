
* Caching is high speed data storage system which saves the transient data so that the further request will not hit 
  the main memory /database. or will not compute the actual computation. All the data will be served from the cached system.
* All the computation results will be reused using the cache.
* The data in the caching system is usually stored in faster access hardware like RAM.

**Caching Best Practices**
* Before you cache something you need to understand the **validity** of the data or  when you understand 
  how long I can save this particular data so that's when we get **high hit rate**
* Othewise it will cause **cache miss**. So, we need to properly set TTL.

**Features/Estimation**

* Tera Byte 
* 50K to 1M QPS(Query Per Second)
* == 1ms latency
* LRU (Least Recently Used) eviction
* 100% Availability
* Scalable