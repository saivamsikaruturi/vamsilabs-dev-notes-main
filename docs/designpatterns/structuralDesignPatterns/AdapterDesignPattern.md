## Code Implementation
[AdapterDp](https://github.com/vamsi1998123/Design-Patterns/tree/master/src/main/java/com/example/designpatterns/structural/adaptordp)


**Intent**
------
*Adapter is a behavioral design pattern that allows objects with incompatible interfaces to collaborate.*

**Adapters are two Types**
1. Object Adapter and
2. Class Adapter

In this example we used Object Adapter. To use Class Adapter we required Multiple Inheritance and java doesn't supports

Also using Class Adapter is violating principle of "Use composition Over Inheritance"

![adaptor_sketch.png](adaptor_sketch.png)
![adaptor.png](adaptor.png)


Try This.
---------
We have different data sources [JPA, Mongo, Cassandra, ...]

Try to create different repositories and without changing any client code. what ever data store client
wants your code should automatically support that without changing business logic and repository logic Changing

_Hint:_ Try To Use Adaptor and Factory Patterns

