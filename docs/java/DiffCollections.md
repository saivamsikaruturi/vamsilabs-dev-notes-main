## Linked Hash Set

- Child class of Hash Set
- It is used when duplicates are not allowed and insertion order should be preserved.
- Underlying data structure is Hash table and linked list.
- For Cache based applications

## Difference between ArrayList & LinkedList
| ArrayList                                                                                                                                                 | LinkedList                                                                                                                            |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| 1) ArrayList internally uses a dynamic array to store the elements.                                                                                       | LinkedList internally uses a doubly linked list to store the elements.                                                                |
| 2) Manipulation with ArrayList is slow because it internally uses an array. If any element is removed from the array, all the bits are shifted in memory. | Manipulation with LinkedList is faster than ArrayList because it uses a doubly linked list, so no bit shifting is required in memory. |
| 3) An ArrayList class can act as a list  because it implements List only.                                                                                 | LinkedList class can act as a list and queue oth because it implements List and Deque interfaces.                                     |
| 4) ArrayList is better for storing and accessing data.                                                                                                    | LinkedList is better for manipulating data.                                                                                           ||                                                                                                                                       |

## Difference between HashMap & HashTable

| HashMap                                                                                                                             | Hashtable                                                                         |
|-------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------|
| 1) HashMap is non synchronized. It is not-thread safe and can't be shared between many threads without proper synchronization code. | Hashtable is synchronized. It is thread-safe and can be shared with many threads. |
| 2) HashMap allows one null key and multiple null values.                                                                            | Hashtable doesn't allow any null key or value.                                    |
| 3) HashMap is a new class introduced in JDK 1.2.                                                                                    | Hashtable is a legacy class.                                                      |
| 4) HashMap is fast.                                                                                                                 | Hashtable is slow.                                                                |
| 5) We can make the HashMap as synchronized by calling this code                                                                     |                                                                                   |
| Map m = Collections.synchronizedMap(hashMap);                                                                                       | Hashtable is internally synchronized and can't be unsynchronized.                 |
| 6) HashMap is traversed by Iterator.                                                                                                | Hashtable is traversed by Enumerator and Iterator.                                |
| 7) Iterator in HashMap is fail-fast.                                                                                                | Enumerator in Hashtable is not fail-fast.                                         |
| 8) HashMap inherits AbstractMap class.                                                                                              |                                                                                   |

## Difference between HashMap,HashTable,SynchronizedHashMap and Concurrent HashMap

| Collection Type       | Synchronization                        | Locking            | No.Of Threads                                             | Null Key & Values                       | Iterator  | When To Use                       |
|-----------------------|----------------------------------------|--------------------|-----------------------------------------------------------|-----------------------------------------|-----------|-----------------------------------|
| HashMap               | Not Synchronous                        | No lock            | Multiple threads                                          | One null key ,N no.of null values       | Fail fast | Single Thread                     |
| HashTable             | Synchronous                            | Object level lock  | Single thread                                             | Does not allow null key and null values | Fail Safe | Legacy class not recommended      |
| Synchronized HashMap  | Synchronous                            | Object level lock  | Single thread                                             | One null key , N no.of null values      | Fail Safe | Multi Thread(Low Performance)     |
| ConcurrentHashMap     | Only write operations are synchronized | Segment level lock | 16 threads perform write and ‘N’ threads can perform read | Does not allow null key & values.       | Fail Safe | Multi Thread((Better Performance) |


## Difference between HashMap and TreeMap


| HashMap                                                                                                                            | TreeMap                                                                            |
|------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------|
| It stores key-value pairs                                                                                                          | It stores key-value pairs and sorts according to the natural ordering of its keys. |
| It uses hashing algorithm                                                                                                          | TreeMap implements Red-Black tree implementation.                                  |
| Time complexity for get() ,put() operation is O(1)  by assuming the hash function dispers the elements properly among the buckets. | Time complexity for containsKey,get,put and remove operations is log(n).           |
| HashMap allows one null value as key.                                                                                              | TreeMap doesn’t allow null key but values can be null.                             |
| HashMap is fast.                                                                                                                   | TreeMap performance is less than HashMap due to f=default sort in nature.          |
| HashMap constructor takes bucket size.                                                                                             | TreeMap doesn’t have constructor to specify the size of the elements.              |


## Difference between Comparable and Comparator


| Comparable            | Comparator                                |
|-----------------------|-------------------------------------------|
| Natural Sorting Order | Customized Sorting                        |
| Java.lang             | Java.util                                 |
| compareTo()           | Compare and equals()                      |
| Homogenous objects    | Both Homogenous and Heterogeneous Objects |