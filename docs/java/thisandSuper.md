
* super is for the parent class.
* this is for the child class.
* The super keyword is used to access variables from the super/parent class.
* The super() method is used to access the super class methods and its constructors.
* this keyword is used to access variables from the child class.
* this() method is used to invoke another constructor within the same class.


```java
public class ThisAndSuperkeyword extends Super {

    public static void main(String[] args) {

    ThisAndSuperkeyword t = new ThisAndSuperkeyword(1, 2, 3);
    t.getVariable();
   
    }

    int a = 10;
    int b = 1000;
    int c = 100;

    public void getVariable() {
        int a = 20;
        System.out.println("this.a:: "+ this.a);
        System.out.println("present:: "+ a);
        System.out.println("super.a:: "+super.a);

    }

    ThisAndSuperkeyword() {
        super();
        System.out.println("no arg constructor");
    }

    ThisAndSuperkeyword(int a) {
        this();
        System.out.println("single param constructor");
    }

    ThisAndSuperkeyword(int a, int b) {
        this(100);
        this.a = a;
        this.b = b;
        System.out.println("two param constructor");
    }

    ThisAndSuperkeyword(int a, int b, int c) {
        this(1, 2);
        this.a = a;
        this.b = b;
        this.c = c;
    }

    }


    public class Super {
    int a = 100;

    Super() {
        System.out.println("super");
    }


    }
```

<!-- termynal -->
```
    super
    no arg constructor
    single param constructor
    two param constructor
    this.a:: 1
    present:: 20
    super.a:: 100
```