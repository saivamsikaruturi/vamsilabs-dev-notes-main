the facade pattern makes a complex system easy to use for the

client applications.


![Facade.png](Facade.png)

For example, let's say we have three different classes or three different methods which handle checking

the stock if a product is available in stock.

The second class is responsible for placing the order if the stock is available.

And the last class is where the shipping of the order itself is.

Handle the client application, which wants to do this order.

Processing has to use all these three classes or methods and it needs to be aware of the method signatures

and all that.

That is where the facade pattern comes in.

The facade class will make it super easy for the client.

The client will use just the facade class and the method on it, and the facade class is responsible

for handling everything else.

Only the facade will be aware of the other classes or methods, and the client is hidden from all that

complexity.

Facade pattern was much more popular in the age old days of EJBs and remote procedural calls where the

client, instead of making multiple network calls to get the job done, he can make a single call to

Facade class, which will make all the other calls that are required within the system.

Even in restful web services which are used today, the facade pattern can be very powerful.

Instead of making multiple restful calls into the same API, the provider can expose out a facade class,

which can be one more layer on top of the restful classes, and it can reduce the complexity in the

network calls for the client.

So Facade simply hides the complexity of the system by becoming a layer in between, the client will only

know about the facade and it hides all the other complexity.

These can be classes multiple classes or these can be methods within a single class as well.

So in the next few lectures, you're going to implement this order processor instead of the client directly

using this order processor and the methods inside it.

Check Stock Place Order and ship order will implement an order FACADE class.

This order FACADE class knows how to use the order processor and all the methods inside at.

The facade will be using the order processor, it will have a single method called process order within

this method, it will invoke checking the stock, placing the order and shipping the order.

The client will be much simpler.

This guy will only use the facade and he will simply say FACADE dot process order.

And the facade in turn uses this order processor and makes use of all these methods.

These methods can be spread across multiple classes as well.

They all need not be in the same class or facade can deal with multiple classes or multiple methods.

It hides the complexity for the client.