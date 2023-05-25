# SpringBoot

## References
* <https://docs.spring.io/spring-boot/docs/current/reference/htmlsingle/>
* <https://github.com/spring-projects/spring-boot>
* <https://github.com/spring-io/start.spring.io>
* <https://github.com/spring-io/initializr>

!https://s3-us-west-2.amazonaws.com/secure.notion-static.com/3f28b7df-7244-4abe-be1e-63aba90b1a80/image1.png

**SPRING MVC FLOW**

1. Client(Browser) requests for a Resource in the web Application.
2. The Spring front controller i.e, DispatcherServlet first receives the request.
3. DispatcherServlet consults the HandlerMapping to identify the particular controller for the given URL.
4. HandlerMapping identifies the controller for the given request and sends to the DispatcherServlet.
5. DispatcherServlet will call the handleRequest(request,response) method on Controller. A Controller is developed by writing a simple java class which implements Controller interface or extends its adapter class.
6. Controller will call the business method according to business requirement.
7. Service class will call the DAO class method for business data.
8. DAO interacts with DB to get data.
9. DAO returns same data to service.
10. Fetched data will be processed according to business requirement and return results to Controller.
11. The Controller returns the Model and View in the form of Object back to the Controller i.e, DispatcherServlet.
12. The front controller i.e, DispatcherServlet then tries to resolve the actual View which may be JSP,velocity or Free Marker by consulting the View Resolver Object.
13. ViewResolver selected view is rendred back to the DispatcherServlet.
14. DispatcherServletconsult the particular view with the model.
15. View executes and returns HTML output to the DispatcherServlet.
16. DispatcherServlet will sends the output to the Browser.

**HTTP Methods:**

**PUT Vs Post:**

1. To update each and every detail of a record the go for Put Request. To create a new record go for Post Request.
2. Post is not idempotent. Whereas Put is idempotent.
3. When we hit the same data for multiple times using Post Request , multiple records are inserted in Db. Whereas using Put the record is updated , new record is not created.

**Get vs Post :**

| GET                                                                                                         | POST |
|-------------------------------------------------------------------------------------------------------------| --- |
| We can use GET method to Get info from the server                                                           | We Can use Post method to post information to the server. |
| Usually GET Requests are Read -only                                                                         | Usually Post requests are write or update operations. |
| End-user provided information will be appended to the URL as the part of Query String and send to the user. | Information will be encapsulated in the request body and send to the server. |
| By Using Get Request we can send only Character data but not images/files.                                  | By Using Post request we can send both Binary and Character data to the server. |
| By using Get request we can send only limited amount of information , depends on browser.                   | By using Post request we can send huge amount of information to the server. |
| Security is less , hence sensitive info like user names or passwords cannot be send.                        | Security is more. |
| Caching of Get is possible                                                                                  | Caching is not possible. |

Put vs Patch:

1. To Update a single or some parameters in a record then go For Patch , To update a all values in a record go for Put request.
2. If we use Put request for updating some parameters then remaining parameters will be updated as null.

**SPRING BOOT ACTUATORS:**

Actuators is one of the feature available in Spring Boot

Actuators are used for providing Production Ready Features for the application

By Using Actuators we can monitor and manage our application.

What is health of our application?

How many beans loaded by our application?

What config props loaded by our application

What is heap info

How many threads are running in our application

How many url mappings available ?

We need a need dependency in pom.xml

<**dependency**>

<**groupId**>org.springframework.boot</**groupId**>

<**artifactId**>**spring-boot-starter-actuator**</**artifactId**>

</**dependency**>

**management**:

**endpoints**:

**web**:

**exposure**:

**include**: **'*'
endpoint**:**health**:**show-details**: always**beans**:**enabled**: true

- -> Once our application started we can use below URL to see actuator endpoints which are exposed

**http://localhost:8090/actuator**

**{**

**"_links":{**

**"self":{**

**"href":"http://localhost:8090/actuator",**

**"templated":false**

**},**

**"auditevents":{**

**"href":"http://localhost:8090/actuator/auditevents",**

**"templated":false**

**},**

**"beans":{**

**"href":"http://localhost:8090/actuator/beans",**

**"templated":false**

**},**

**"caches-cache":{**

**"href":"http://localhost:8090/actuator/caches/{cache}",**

**"templated":true**

**},**

**"caches":{**

**"href":"http://localhost:8090/actuator/caches",**

**"templated":false**

**},**

**"health-component":{**

**"href":"http://localhost:8090/actuator/health/{component}",**

**"templated":true**

**},**

**"health":{**

**"href":"http://localhost:8090/actuator/health",**

**"templated":false**

**},**

**"health-component-instance":{**

**"href":"http://localhost:8090/actuator/health/{component}/{instance}",**

**"templated":true**

**},**

**"conditions":{**

**"href":"http://localhost:8090/actuator/conditions",**

**"templated":false**

**},**

**"configprops":{**

**"href":"http://localhost:8090/actuator/configprops",**

**"templated":false**

**},**

**"env":{**

**"href":"http://localhost:8090/actuator/env",**

**"templated":false**

**},**

**"env-toMatch":{**

**"href":"http://localhost:8090/actuator/env/{toMatch}",**

**"templated":true**

**},**

**"flyway":{**

**"href":"http://localhost:8090/actuator/flyway",**

**"templated":false**

**},**

**"info":{**

**"href":"http://localhost:8090/actuator/info",**

**"templated":false**

**},**

**"logfile":{**

**"href":"http://localhost:8090/actuator/logfile",**

**"templated":false**

**},**

**"loggers":{**

**"href":"http://localhost:8090/actuator/loggers",**

**"templated":false**

**},**

**"loggers-name":{**

**"href":"http://localhost:8090/actuator/loggers/{name}",**

**"templated":true**

**},**

**"heapdump":{**

**"href":"http://localhost:8090/actuator/heapdump",**

**"templated":false**

**},**

**"threaddump":{**

**"href":"http://localhost:8090/actuator/threaddump",**

**"templated":false**

**},**

**"metrics-requiredMetricName":{**

**"href":"http://localhost:8090/actuator/metrics/{requiredMetricName}",**

**"templated":true**

**},**

**"metrics":{**

**"href":"http://localhost:8090/actuator/metrics",**

**"templated":false**

**},**

**"scheduledtasks":{**

**"href":"http://localhost:8090/actuator/scheduledtasks",**

**"templated":false**

**},**

**"httptrace":{**

**"href":"http://localhost:8090/actuator/httptrace",**

**"templated":false**

**},**

**"mappings":{**

**"href":"http://localhost:8090/actuator/mappings",**

**"templated":false**

**}**

**}**

**}**
