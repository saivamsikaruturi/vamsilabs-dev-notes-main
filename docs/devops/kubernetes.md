
* Kubernetes is an open-source system for automating deployment, scaling and management of containerized applications.

**Problem Statement 1**:

* We have containerized our application and deployed on virtual machine.
* There can be problem in the container or vm/node and either of them is crashed. Then we cannot access our service.
* In real time, there will be many containers as we deal with microservices architecture.

![k8sintro.PNG](k8sintro.PNG)

* we never know when and which container goes down, can we monitor it manually and restart our stopped containers ?
* There is a way to monitor the health of each container and node to bring them back when they go down. This is called self-healing or resilience.
* K8S checks or monitors the health of each container and node and bring them back when they go down. So we will not face any downtime. This is called as High-availability.

**Problem Statement 2**:

* Your application is working fine for 20 requests per seconds, what if the requests are 100 per second ?
* The application cannot handle the load.
* What if there is a way to replicate the same application into multiple containers, if required across multiple nodes and put a load balancer in front of those containers.
* So, any request made, initially goes to the load balancer and oit distributes the load among multiple containers.
* Now the application can handle the load.

![problem2.jpg](problem2.jpg)

* What if there is a way to increase the number of containers if the load 