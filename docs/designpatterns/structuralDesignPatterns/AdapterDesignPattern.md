
If you have used a power adapter then you already know what a adapter pattern is .The job of a power adapter is

to adapt it to a particular location and a particular switchboard.

For example the same laptop plug pins that work in USA will not work in UK and in India.

So will have to use appropriate power adapter that can take our laptop pins into it and on the other side

of it it will have pins that can go into the local countries switchboard and it can also adapt to

the appropriate range in that country.

Similarly in the world of programming when we have two applications communicating with each other or

two objects using each other and one object invokes the method off another object.

Then we have to adapt in some cases for example here we have a weather finder class which has a find

weather by passing in a city you can get the weather and we have a implementation of it which will

return the weather back and there is a UI class that wants to use the weather finder but the UI

only knows the zip code of the city.

It does not have the city information it only has the zip code but it wants to get the weather of it.

That is where a adapter comes in.

Will implement a adapter which will take the zip code.

So the weather UI will invoke the find temperature Method on the weather adapter it will pass in the zip code.

The weather adapter is responsible for looking up for the appropriate city that matches the zip code

it will then invoke the weather finder take the results and it will return the results back to the

weather.

UI. So it exactly acts like a power adapter.

It takes the inputs from the class that wants to use another class because the inputs here are different

from what the other side of the relationship expects.



![Adapter.png](Adapter.png)