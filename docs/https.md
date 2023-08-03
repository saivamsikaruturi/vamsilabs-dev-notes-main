* With HTTP the communication between client and server is in plain text.
* i.e the password or the credit card you enter can be read by anyone who has the ability to intercept it.
* HTTPS is designed to solve this problem.i.e to make the data sent over the internet unreadable by anyone other than the sender and the receiver.
* HTTP is an extension of Http protocol.
* In https data is send in an encrypted form using TLS.
* TLS Stands for Transport Layer Security.
* If the encrypted data gets intercepted by a hacker all they could see is jumbo data.

*Working*
* Step 1: TCP Handshake
  * Just like in the case of http, the browser establishes TCP connection with the server.
* Step 2: Certificate
  * This is where TLS Handshake begins.
  * The process sends a client hello message to the server.
  * In this hello message the browser tells the server , it will tell the server the TLS version (TLS 1.2 ,1.3) it supports and the Cyber suite it supports.
  * A cyber suite is a set of encryption algorithms.
  * The server sends back the  hello message with all the tls and cyber suite details sent by the client.
  * Server sends the certificate to the client.
  * The certificate a lot of things but one important thing is public key.
  * The client uses this key in asymmectric encryption.
  * In aymmetric encryption a piece of data that is encrypted by a public key can only be decrypted by the private key.
  * The step 2 is concluded by sending a hello done by the server.
* Step 3: Key Exchange
  * In this step the client and server come up with a share encryption key to use to encrypt data.
  * This is where asymmetric encryption comes.
  * The client generates an encryption key also called session key with RSA.
  * This session key will be encrypted with a server public key and sends to the server.
  * The server receives the session key and decrypts with its private key.
  * So both the client and the server will have the session key.
* Step 4: Data Transmission.
  * They send the encrypted data between the client and the server using this session key.