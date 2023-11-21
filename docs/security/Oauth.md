* It’s an open standard Or A Protocol for authorization .

* Security -
  Authentication - Who u are?
  Authorization - What do u want ?

* OAuth 2 is an authorization framework that enables applications — such as Facebook, Twitter— to obtain limited access to user accounts on an HTTP service.

* It works by delegating user authentication to the service that hosts a user account and authorizing third-party applications to access that user account.

* OAuth 2 provides authorization flows and not the authentication.

* There are two versions of OAuth: OAuth 1.0a and OAuth 2.0. These specifications are completely different from one another, and cannot be used together: there is no backwards compatibility between them. OAuth 2.0 is the most widely used form of OAuth

**How Oauth 2.0 works ?**

* The application requests authorization to access service resources from the user

* If the user authorized the request, the application receives an authorization grant

* The application requests an access token from the authorization server (API) by presenting authentication of its own identity, and the authorization grant

* If the application identity is authenticated and the authorization grant is valid, the authorization server (API) issues an access token to the application. Authorization is complete.

* The application requests the resource from the resource server (API) and presents the access token for authentication

* If the access token is valid, the resource server (API) serves the resource to the application

* It is designed primarily as a means of granting access to a set of resources, for example, remote APIs or user data.

**What are Scopes and Tokens?**

* Scopes and tokens are how OAuth implements granular access controls.

* Together they represent a “permission to do something.” The token is the “permission” part and the scope defines what the “do something” is.

* Think of a movie ticket: the scope is the name of the movie you are authorized to watch and the ticket itself is the token, which only a theater employee can validate as authenticate. Also tokens have expiration date. Similar to movie time written on movies ticket.

* Access token also have scope information

* There are four types of scopes:

   a) Read Access
   b) Write Access
   c) Read and Write Access
   d) No Access


**What are grants ?**

* Application grant types (or flows) are methods through which applications can gain Access Tokens and by which you grant limited access to your resources to another entity without exposing credentials.

* Taking an example of movie ticket booking. You can get access to movie tickets by 2 ways

* Walking to theater and purchase from window book online

* These are 2 grants or flows. The method you’ve chosen dictates what you will do to obtain the ticket.

* Similar is Grant types - ways to obtain access token

* Oauth2 provides following Grants -

* Client Credentials  -  Used for non-interactive applications e.g., automated processes, microservices, etc. In this case, the application is authenticated per se by using its client id and secret

* Authorization Code -  The Authorization Code flow might be used by Single Page Apps (SPA) like Angular applications. In such SPA,  the client secret cannot be stored securely, and so authentication, during the exchange, is limited to the use of client id alone