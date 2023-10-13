
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
* So, any request made, initially goes to the load balancer, and it distributes the load among multiple containers.
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

* The place where we run the containers is physical or virtual machines is known as nodes more specifically worker nodes.
* Generally there will be multiple worker nodes so that of one node goes down containers can be run in other nodes.
* Also we can run the same application on multiple nodes to share the node.
* We call these set of worker nodes as data plane
* Some one should manage these worker nodes like if one node goes down moving the containers to a healty node etc.
* This contoller part is taken care by another node called Master node or control-plane.
* In real-time there will be more than one master node for fault tolerance.

![k8sArchitecture.PNG](k8sArchitecture.PNG)
* So a k8s cluster consists of a group of worker nodes and set of master nodes which manages the worker nodes.

**Master Node Components**:

* It consists of components that control the cluster and data about the cluster state and configuration.

    **kube API SERVER**:

      * To interact with the k8s the user can use the apis provided by api server through cli or sdk.
      * We can call api server as front end for the k8s control plane.
      * So with this api we can instruct the k8s to do some operations like scheduling pod, get the list of pods etc.

    **etcd**:
      * This is a storage where we can track all the nodes we have in the clusters and the containers details.
      * Its a key value store to save clustered data, recommended to have backup plan.
      * It is accessible only from api server for security reasons.No other component can directly interact with etcd.
      * This etcd has a wonderful feature called watch api. The watch waits for the changes to keys by continuously watching and sends those key updates back to the client.
      * so if any change happens in the records k8s api will respond accordingly.

    **kube scheduler**:
      * It helps to schedule the pods based on the various nodes based on the resource utilization.

    **kube control manager**:
      * when a change in a service config occurs for ex: replacing the image from which the pods are running or changing parameters in the config.yml, the controller spots the change amd starts working towards the new desired state.
      Types of Controllers
      * Replication Controller (correct no.of pods are running in the cluster)
      * Node Controller (monitors health of each node)
      * Endpoint controller (connects the pods and services to populate the object)

**Worker Node Components**: