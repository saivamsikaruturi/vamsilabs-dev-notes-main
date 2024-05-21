INTERSEVICE COMMUNICATION:
•	Inter-service communication refers to the exchange of data and messages between different software services or microservices within a larger application or system. This communication is crucial for enabling various components to work together cohesively. Here’s a basic outline of the documentation you might need for inter-service communication.
Types of Inter service communication.
1.	Synchronous Communication
      •	HTTP/HTTPS: Using RESTful APIs or SOAP (Simple Object Access Protocol) for synchronous communication over HTTP or HTTPS using rest Template , rest client , web client or feign client.
      •	RPC (Remote Procedure Call): Direct invocation of procedures or methods on remote services.
2.	Asynchronous Communication
      •	Message Queues: Using systems like RabbitMQ, Apache Kafka, or AWS SQS for asynchronous message passing.
      •	Event-Driven Architecture (EDA): Services communicate through events and event handlers asynchronously.

Synchronous Communication:
•	It abstracts the complexities of HTTP request creation and response handling, providing methods like exchange , getForObject, postForObject, getForEntity, postForEntity, etc.
Exchange method:

url: The URL of the resource to be accessed.
method: The HTTP method to use for the request (e.g., GET, POST, PUT, DELETE).
requestEntity: An HttpEntity object representing the request body, headers, and other details.
responseType: The type of the response body that is expected.
uriVariables: Optional variables to be substituted into the URL, if it's a templated URL.
Return Type:
ResponseEntity<T>: Represents the entire HTTP response including status code, headers, and body.


    public Boolean getInventoryDetails(String skuCode, int quantity) {
    String apiUrl = "http://localhost:8082/api/inventory";

    String urlWithParams = String.format("%s?skucode=%s&quantity=%d", apiUrl, skuCode, quantity);
        ResponseEntity<Boolean> response = restTemplate.exchange(
                urlWithParams,
                HttpMethod.GET,
                new HttpEntity<>(null, getHeaders()),
                Boolean.class
        );
        return response.getBody();
       }

     private HttpHeaders getHeaders() {
     HttpHeaders headers = new HttpHeaders();
     headers.setContentType(MediaType.APPLICATION_JSON);
     // Add any additional headers if needed
     return headers;
      }

