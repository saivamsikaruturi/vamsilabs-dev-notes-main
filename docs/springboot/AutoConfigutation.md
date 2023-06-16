What is Auto Configuration?

* Instead of developer having to configure every aspect of the application explicitly spring boot follows **Convention Over Configuration** approach where
  if you follow certain conventions you don't need to configure everything explicitly, and you need to configure only if you are deviating from the default conventions.
* So that way it will drastically simplify the need for more configuration.
* For Example , if we are configuring our application properties we don't need to explicitly configure @PropertySource(value ={"classpath:application.properties"}). Spring boot automatically load from application.properties from the classpath and automatically register those beans.
* Similarly, if you are adding a spring boot web starter it will automatically assume that you are going to build a web application or a REST api and automatically adds Tomcat as a servlet container because that is the most widely used.
* Some Customization Supports.
* for example the default port is 8080 but if we change the port you can configure server.port = 9090

**CaseStudy**: DataSource Auto Configuration
1. Use explicitly registered bean, if defined
2. Use properties from application.properties 
3. Use in-memory JDBC driver if available on classpath

* Spring Boot Auto Configuration mechanism works by conditionally registering the beans
**Conditional Bean Registration**
* @ConditionalOnClass
* @ConditionalOnMissingClass
* @ConditionalOnMissingBean
* @ConditionalOnProperty
* @ConditionalOnExpression