Creational Design Patterns:

  * Creational Design patterns abstract the instantiation process. They help make a system independent of how its objects are created ,composed and represented.
  * A class creational pattern uses inheritance to vary the class that's instantiated , whereas an object creational pattern will delegate instantiation to snother object.
  * These patterns become important as systems evolve to depend more on object than on class inheritance.
  * There are two recurring themes in these patterns. First, they all encapsulate knowledge about which concrete the system users. Second, they hide how instances of these classes are created and put together.
  * Consequently, the creational patterns give you a lot of flexibility in what gets created, who creates it, how its get created and when.

Types Of Creational Patterns:
1. Singleton
2. Factory
3. Abstract Factory
4. Builder
5. Prototype

Singleton Design Pattern:
* Creational Design Pattern
* Only one instance of the class should exist
* Other classes should be able to get Instance of Singleton class.
* Used in Logging, Cache, Session and Drivers.

Implementation:
* Constructor should be private
* Public method for returning instance
* Instance type - private static

Initialization Type:
* Eager Initialization
* Lazy Initialization
* Thread safe Method Initialization
* Thread safe block Initialization

1.Eager Initialization:

    public class Singleton{

     private static Singleton singleton = new Singleton();

    private Singleton() {}

    public static Singleton getInstance(){

        return  singleton;

    }    public static void main(String[] args) {
       Singleton instance= Singleton.getInstance ();
        Singleton instance1=Singleton.getInstance ();
        System.out.println(instance);
        System.out.println(instance1);
    }  }


 2. Lazy Initialization:

 
    public class Singleton{

    private static Singleton singleton;

    private Singleton() {
    }
    public static Singleton getInstance(){
        if(singleton==null){
            singleton=new Singleton();
        }
        return  singleton;
    }

     public static void main(String[] args) {
     Singleton instance= Singleton.getInstance ();
      Singleton instance1=Singleton.getInstance ();
       System.out.println(instance);
       System.out.println(instance1);  } }







Prototype:
Specifying the kind of objects to create using