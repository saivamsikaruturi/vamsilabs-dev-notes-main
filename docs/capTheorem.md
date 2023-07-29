* It is the Desirable property of distributed System with replicated data.
  C - Consistency
  A - Availability
  P - Partition Tolerance
* We can use CA , CP or AP . but not CAP.
* Why we cannot use all the three at once??
* Consistency: After successful write in any node, the data should be same in any other node.
* Availability: All nodes should be available.
* Partition Tolerance: System is up.
   
* When there is some partition issue , then there will be no consistence then only AP.
* When one node is down, then there is no Availability , then only CP.

![databaseissues.PNG](databaseissues.PNG)

* data from master to slave is asynchronous.
* less writes,more reads
* If the user access the data currently, he wrote something and if he immediately accesses the data , then it the data will be 
   accessed from slave.
*  If he accesses the data even before the data is sent from master to slave.So whatever we have written in master will not be available in slave. So he will not able to get it think it as a bug or inconsistency.
* This is not a consistent system.

*Sharding*

![sharding.PNG](sharding.PNG)
* In this case there is no master and slave, but all data is divided into different segments.
* Figuring out the sharding key is the important task.
* Suppose we want to store user info, then we can take username as the sharding key. For example the user name starting with A-I will
  be in shard-1, J-S in shard-2 and T-Z in shard-3.

