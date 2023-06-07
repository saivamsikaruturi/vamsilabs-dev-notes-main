
* Before Java, Memory Management must be done by the java programmer.
* But in java, it is the responsibility of Garbage Collector.
* Garbage Collection means remove objects that are not used anymore.

    live object = reachable (referenced by some other)
           
    dead object = unreachable

* Most objects soon become un reachable.
* References from old objects to young objects only exists in small number.

**Basics:**

* Objects are allocated (ex: using new kwyword) in the heap of java memory.

* Static members, class definitions (metadata) are stored in PERMGEN/Metaspace.

* Garbage collection(GC) is carried out by a daemon thread called **Garbage Collector**

* We cannot force garbage collection to happen .

* When new allocations cannot happen due to full heap you end up with **java.lang.OutOfMemoryError**. heap spaceand a lot of headaches.

**Involves:**

Mark:starts from root node ,walks the object graph and marks reachable as live.

Delete: delete unreachable objects.

Compacting: compact the memory by moving around the objects and making the allocation contiguous than fragmented.

**Generational Collectors:**
               ![gc.PNG](gc.PNG)

* Intially the new objects are created in the young generation space i.e when a new HashMap is created it is created in eden space.
* When the eden space is full , small/minor GC kicks up and cleans up the eden space of all unreachable objects.
* All the reachable objects will reach the survivor S0 and then the eden space is free. So, then new objects can be created in eden space.
* The reason , why there are 2 survivor space:
  if the objects survives a lot of cycles of GC, then it moves from S0 -> S1. then to old generation.


  ![workingofgc.PNG](workingofgc.PNG)

* To avoid another run steo of compacting this process continues until a Thresold of **16.**


**Types of GC::**

![typesofgc.jpg](typesofgc.jpg)

**1. Serial Collector:**

* Basic Garbage Collector that runs in single thread.
* Use for Basic Applications.

**2. Concurrent Collector:**

* A thread that performs GC along with the application execution as the application runs doesn't wait for the old generation to be full.
  Use when:
  * There is more memory.
  * There is high number of CPU's.
  * Application demands- short pause.

**3. Parallel Collector:**

* Uses multiple CPU's to perform GC. 
* Multiple threads does mark/sweep.
* Doesn't kick in until heap is full/near-full.
  Use when:
  * Less memory.
  * Application demands high throughout and can withstand pauses.
  
**4. G1 Garbage Collector:**

* Introduced in 1.7 version.
* It straddles the young-tenured generation boundary as it divides heap in to different regions and during a GC it can collect a sub-set of regions.
* It dynamically selects a set of region to act as young generation in next GC cycle.
* Regions with most unreachable will be collected first.
  Use when:
  * More predictable GC pause.
  * Low Pauses with fragmentation.
  * Parallelism and Concurrency together.
  * Better heap Utilization.