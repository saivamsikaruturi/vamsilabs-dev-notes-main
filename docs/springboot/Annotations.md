**@Component**
* The component annotation indicates that an annotated class is a "spring bean/component".
* The @Component annotation tells Spring container to automatically create Spring bean.

**@Autowired**
*The @Autowired annotation is used to inject the bean automatically.
*The @Autowired annotation is used in constructor injection,setter injection and field injection.

**@Qualifier**
*This annotation is used in conjunction with Autowired annotation to avaoid confusion when we have two or more beans configured for the same type.

**@Bean**
* @Bean annotation indicates that a method produces a bean to be managed by a spring container.
* The @Bean annotation is usually declared in Configuration class to create Spring Bean definitions.
* By default, the bean name is same as method name. We can sp*ecify bean name using @Bean(name = "beanName")
* @Bean annotation provides initMethod and destroyMethod attributes to perform certain actions after bean initialization or before bean destruction by the container.


## StereoType Annotations
* These annotations are used to create Spring beans automatically in the application context (Spring IOC container)
* The main stereotype annotation is @Component.
* By using this annotation, Spring provides more Stereotype meta annotations such as **@Service ,@Repository and @Controller**
* @Service annotation is used to create Spring beans at the Service layer.
* @Repository is used to create Spring beans for the Repositories at the DAO layer.
* @Controller is used to create Spring beans at the controller layer.

![sterotype.png](sterotype.png)

**@Lazy**
* By default, Spring creates all singleton beans eagerly at the startup/bootstrapping of the application context.
* You can load the Spring beans lazily (on-demand) using @Lazy annotation.
* @Lazy annotation can be used with @Configutation, @Component and @Bean annotations.
* Eager initialization is recommended to avoid and detect all possible errors immediately rather than at runtime.

**@Scope**
* It is used to define a scope of the bean.
* We use @Scope to define the scope of a @Component class or a @Bean annotation.

* The latest version of the Spring framework defines 6 types of scopes.
   * Singleton
   * prtototype
   * request
   * session
   * application
   * websocket
*The last four scopes are only available in a web-aware application.

**@Value**
* Spring @Value annotation is used to assign default values to variables and method arguments.
* Value annotations is mostly used to get value for a specific property from the properties/yml file.

**@Controller**
* Spring provides @Controller annotation to make a Java class as a Spring MVC Controller. The @Controller annotation indicates that a particular class serves the role of a controller.
* Controller in Spring MVC web application is a component that handles incoming HTTP requests.
* @Controller annotation is simply a specialization of the component class, which allows us to auto-detect implementation classes through the classpath scanning.
* We typically use @Controller in combination with a @RequestMapping annotation for request handling methods.

**@RestController**
* In order to develop a REST-FUL Webservices using spring MVC, we need to use @Controller and @ResponseBody annotations.
* Spring 4.0 introduced @RestController, a specialized version of the @Controller which is a convenience annotation that does nothing more than the @Controller and @ResponseBody annotations.
* Inorder to create Restful webservices using Spring MVC, you need to annotate a Java class with @RestController annotation.
* When using @RestController, the response is typically in the form of JSON or XML, but it can also handle other media types by specifying the produces attribute in @RequestMapping or specific media type annotations like @GetMapping or @PostMapping.


                                   

