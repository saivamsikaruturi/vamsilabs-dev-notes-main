* In this version, JRE or Server JRE is no longer offered. Only JDK is offered.
* Auto-update has been removed from JRE installations in Windows and macOS.
* Launch Single-File Programs without Compilation (without .class file)
* new method- toArray(int) in util.collection
* Local Variable syntax for lambda parameters
* String API Changes
   * isBlank()
     String s =" ";
     System.out.println(s.isBlank()); //true
     System.out.println(s.isEmpty()); //false
   * lines()
   * strip();
```JAVA
class StripExample {
  public static void main(String[] args) {
    String s = "test string\u205F";
    String striped = s.strip();
    System.out.printf("'%s'%n", striped);//'test string'

    String trimmed = s.trim();
    System.out.printf("'%s'%n", trimmed);//'test string '
  }
}
```
   * stripLeading();
   * stripTrailing();
   * repeat();
* Pattern Recognizing Methods
var str = Pattern.compile("aba").asMatchPredicate();

       str.test(aabb);
       Output: false

       str.test(aba);
       Output: true

* Files.readString(),Files.writeString()

* HTTP Client API : In previous versions of Java, the most commonly used libraries for HTTP communication were Apache HttpClient and the legacy HttpURLConnection class. While these libraries served their purpose, they had limitations. The APIs were often complex, lacking flexibility, and struggled to keep up with modern web standards.
* making it asynchronous and non-blocking by default. This means that applications can send HTTP requests and continue their execution without waiting for the responses, leading to improved performance and responsiveness.

         HttpClient client = HttpClient.newHttpClient();
         HttpRequest request = HttpRequest.newBuilder()
         .uri(URI.create("https://api.example.com/data"))
         .build();

         CompletableFuture<HttpResponse<String>> responseFuture =
         client.sendAsync(request, HttpResponse.BodyHandlers.ofString());
         responseFuture.thenAccept(response ->
         System.out.println("Response code: " + response.statusCode()));