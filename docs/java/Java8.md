**JAVA 8 Features**

1.Functional Interfaces

2.Lambda Expressions

3.Default Methods in Interfaces

4.Static Methods in Interfaces

5.Predefined Interfaces

6.Method Reference ,Constructor Reference

7.Stream API

8.Date and Time API

9.Optional Class

**Functional Programming**

From Java 8 Version ,Using Functional Programming we can pass a function as an argument to a method

    class Calculator{

    static void evaluate(Addition a ){

    a.add(10,20);

    }

    Addition addNumbers =(a,b)-(a+b); Functional Programming

    System.out.println(addNumbers.add(1,2));

**Definition of Functional Interface:**

Only one abstract method in interface is called Functional Interface.

Examples of Functional Interface :

Comparable

Comparator

Runnable

Callable

**Why Functional Interface**

- Functional Interface is used for enabling Functional Programming in Java
- Functional Interface is also used for defining Lambda Expressions to pass a function directly as an argument.




    @FunctionalInterface
    
      interface Addition(){

      void add(int a ,int b);

      void add(int a, int b ,int c); ----- compiler will start throwing error , only one abstract method should be there

    }


**@FunctionInterface**

@FunctionInterface is a marker annotation to mark the interface as a functional Interface explicitly

Two ways of creating Functional Interface

1.Creating as Effective Functional Interface

2.Forcing it to be a Functional Interface

**Annonymous Inner Class:**

i.e Inner Class without Name , only one time use (instant use)

**LAMBDA EXPRESSIONS:**

- It is an anonymous function without name, return type and modifiers.
- To enable functional programming
- By using “--”

    
     public int getSum(int a ,int b){

     System.out.println(a+b);

    }

    ()-System.out.println(“Java Programming”);

    (int a ,int b)- System.out.println(a+b);

**Default Method in Interfaces:**

Default method came into picture for solving limitation of interfaces. For adding more functionality methods in interface without breaking the implementation classes functionality.

    interface Example{
    abstract **void** m1();
    abstract **void** m2();
    }

    class Sample implements Example{ 
    public void m1(){
    }
    }

    class Demo implements Example
    {
    public void m1(){
    }
    }

Since there is no implementation of m2() method in both classes ,compiler throws error. So, in java 8 concept of default method is introduced.

     interface** Example{
     abstract **void** m1();
     default **void** m2(){
    }
    }

**Static Method in Interfaces:**

Q. What is the purpose of introducing static methods in java interface ?

Java interface static methods are good for providing utility methods, for example null check, collection sorting etc. Java interface static method helps us in providing security by not allowing implementation classes to override them.

Q. What will happen if I override static method ?

Try to add @Override annotation to the method, it will result in compiler time error.

Q. Is it possible to have multiple static methods in an interface?

Yes,

    interface Example
    {
     static public boolean isNull(String input)
    {

        if(input!=null){return false;
        }
        return true;

    } 
    }    
     public class Sample {
     public static void main(String[] args) {
        System.out.println (Example.isNull("ok"));
    }  
    }


 
**Predefined Interfaces**

1.Predicate

2.Function

3.Consumer

4.Supplier

Two Argument Predefined Functional Interface:

1.BiPredicate

2.BiFunction

3.BiConsumer

Predicate:

Conditional checks

Input

Boolean is return type.

test()

      String[] res={"vamsi","General","sai"};
      Predicate<String employeePredicate=e-e.length()>4;
      for(String s1:res){if(employeePredicate.test (s1))
      {
      System.***out***.println (s1);
      }
      }

Function:

Input and Output

Output type is return type.

apply()

    Function<String,Integer function=fn-fn.length ();
    System.out.println(function.apply("durga"));

Consumer:

Input

Void is return type

Accept()

       Consumer<String consumer=cn-System.out.println (cn);
       consumer.accept ("Capgemini");

        Consumer<Employee emp1=emp123-{
        System.out.println (emp123.getEmpName ());
        System.out.println (emp123.getEmpId ());
        };
        for(Employee employee:employeeList){
        emp1.accept(employee);
        }

Supplier:

It does not require any input , but returns output.

get()

      Supplier<Date date=()-**new** Date ();
      System.***out***.println (date.get ());

//otp generation

       Supplier<String otp=()-{
       String otp1="";
       for(int i=0;i<=6;i++){
       otp1=otp1+(int)(Math.random ()10);
       }
       return otp1;
       };
       System.out.println (otp.get ());

**Method and Constructor Reference:**

- Method Reference and Constructor Reference is alternative to Lambda Expressions.
- Method Reference is used for Code Reusability
- A short end way of writing a lambda expression that will refer to the existing method.
- ::--- Method Reference Operator

Types of Method References:

1.Static Method Reference --- className::method name

2.Instance Method Reference --- object reference :: method name

3.Constructor Reference --- className :: new

If the method returns object ,then we should use constructor reference.

     public interface FunctionalInterface {
     void add(int x,int y);
     }

        public class Test {void add(int x,int y){
        System.out.println (x+y);
        }

        public class MR {public static void main(String[] args) {
        Test t1=new Test ();
        FunctionalInterface function1 =t1::add;
        function1.add (10,20);
        }
        }

Constructor Reference:

    public interface FunctionalInterface {
    public Test get();
    }

        class Test {
        Test(){
        System.out.println ("hello");
        }
        }

        public class MR {public static void main(String[] args) {
        FunctionalInterface f=Test::new;
        Test s=f.get ();
        }
        }

Wherever fn interface , we can use lambda expressions

Function<String,Intgeger f =s-s.length