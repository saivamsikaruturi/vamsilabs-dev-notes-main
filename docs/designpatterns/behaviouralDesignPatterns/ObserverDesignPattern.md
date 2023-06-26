Intent
---------
Define a one-to-many dependency between objects so that when one object
changes state, all its dependents are notified and updated automatically.

Also, Known As
-------------
Dependents, Publish-Subscribe

It specifies communication between objects: observable and observers.
An **observable** is an object which notifies **observers** about the changes in its state.

![observer.png](observer.png)

Example:
-
For example, a news agency can notify channels when it receives news.
Receiving news is what changes the state of the news agency, and it causes the channels to be notified.


[observer example](https://github.com/vamsi1998123/Java-Practice/tree/main/src/main/java/com/vamsi/javaPractice/DesignPatterns/Observer)