
* Kubernetes is an open-source system for automating deployment, scaling and management of containerized applications.

**Problem Statement 1**: (Monitoring,Self-Healing and High Availability)

* We have containerized our application and deployed on virtual machine.
* There can be problem in the container or vm/node and either of them is crashed. Then we cannot access our service.
* In real time, there will be many containers as we deal with microservices architecture.

![k8sintro.PNG](k8sintro.PNG)

* we never know when and which container goes down, can we monitor it manually and restart our stopped containers ?
* There is a way to monitor the health of each container and node to bring them back when they go down. This is called self-healing or resilience.
* K8S checks or monitors the health of each container and node and bring them back when they go down. So we will not face any downtime. This is called as High-availability.

**Problem Statement 2**: (Load Balancing, Auto Scaling,Automatic bin packing)

* Your application is working fine for 20 requests per seconds, what if the requests are 100 per second ?
* The application cannot handle the load.
* What if there is a way to replicate the same application into multiple containers, if required across multiple nodes and put a load balancer in front of those containers.
* So, any request made, initially goes to the load balancer and it distributes the load among multiple containers.
* Now the application can handle the load.

![problem2.jpg](problem2.jpg)

* What if there is a way to increase the number of containers if the load increases and decrease the number of containers if load decreases. This is called as Scaling.
* K8s can that smart job of scaling based on the load.
* It can scale nodes also, meaning if there are multiple containers are running in a node and while creating a new container if there are not enough resources like cpu and ram k8s can **automatically spin up another container** for running the node. This is called automatic bin packing 

**Problem Statement 3**: (Rollout,rollbacks)

* You are deploying the enhancement multiple times a day. What happens when your deployment is going 
  on your old container gets deleted and a new container gets created.
* In the gap of deleting and creating the container your application will be down which is a bad thing.
* When you have multiple containers running of the same application, instead of deleting all containers at once and creating them again with rolling deployments we can replace the containers one by one.
* i.e Rolling Deployments and also upgrade a percentage of containers i.e Canary deployments.


**Problem Statement 4**: (Secret and Config Management)

* For example: the application is running with version:1 , what if we want to deploy new version of the application ? We call this rolling out a new version or 
  what if we want to rollback to a older version if there is an error in the new version.
* With K8S we can deploy and update the secrets and application configuration without rebuilding our image and without exposing secrets in your stack configuration now.


## Features:

* Monitoring
* Self Healing
* High Availability
* Load Balancing
* Auto Scaling
* Automatic bin packing (efficiently scheduling containers onto nodes based on resource constraints)
* Rolling and Canary Deployments
* Automatic Rollout and Rollback
* Secret and Configuration Management.

## K8S Architecture

**Cluster**