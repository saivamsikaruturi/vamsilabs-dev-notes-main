
Scenario 1:
* Consider you have an application which is deployed in a server, and then it is working fine and some day you started to see sudden
  increase in traffic , for ex: 10 times the normal traffic and all the traffic is from BOTS.

Scenario 2:
* Consider you have a product which provides API for payment gateway , you want to restrict the user after 3 requests per day.

* For Both these scenarios the solution is rate limiting.
* Rate limiting products your APIs from overuse by limiting how often user can access your API.
* Once the users quota is finished either the requests are dropped or rejected, and it is very important for many important reasons 
  
  for example: 
  a) User Experience (UX): In the application some users are using overusing the API's in that case the other users will get affected .So if you maintain quality of 
                            service or better UX you need to rate limit.
  b) Security: People might try brut forcing the login API's or some other API's like promo codes , you need to rate limit to protect the application attacked by the hackers.
  c) Operational Cost: For example your application is enabled for auto-scaling or Pay as you go service. If the users are bombarding requests just for fun or by mistake, then the cost will increase.


**Levels at which use can Rate Limit or Types of Rate Limiting**

* User 
* Concurrent
* Location Id
* Server