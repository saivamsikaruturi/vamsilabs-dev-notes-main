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

}

      public static void main(String[] args) {
        Singleton instance = Singleton.getInstance();
        Singleton instance1 = Singleton.getInstance();
        System.out.println(instance);
        System.out.println(instance1);
    }}
2.Lazy Initialization:

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
        Singleton instance = Singleton.getInstance();
        Singleton instance1 = Singleton.getInstance();
        System.out.println(instance);
        System.out.println(instance1);
    }}

3.Thread Safe Method Initialization

    public class Singleton{
     private static Singleton singleton;

    private Singleton() {
    }
    public static synchronized Singleton getInstance(){
        if(singleton==null){
            singleton=new Singleton();
        }
        return  singleton;
    }

       public static void main(String[] args) {
        Singleton instance = Singleton.getInstance();
        Singleton instance1 = Singleton.getInstance();
        System.out.println(instance);
        System.out.println(instance1);
    }}

4.Thread Safe Block Initialization:

    public class Singleton{
     private static Singleton singleton;

    private Singleton() {
    }
    public static Singleton getInstance(){
        if(singleton==null){
           synchronized (Singleton.class) {
        if(singleton == null) {
          singleton = new Singleton();
        }
      }
        }
        return  singleton;
    }

       public static void main(String[] args) {
        Singleton instance = Singleton.getInstance();
        Singleton instance1 = Singleton.getInstance();
        System.out.println(instance);
        System.out.println(instance1);
    }}