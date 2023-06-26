Need Of Constructor

    class Student {
    String name;
    int rollno;
    }

    /* constructor */
    Student(String name , int rollno){
    this.name = name;
    this.rollno = rollno;
    }

    public static void main(String[] args){
    Student s = new Student();
    Student s1 = new Student();

    }

* So if we create objects , a separate copy will be created.
![constructors.PNG](constructors.PNG)
* Constructor is used to initialize an object
* ClassName objname =new Constructor();

      Student s =new Student ("Vamsi" ,1);
![c1.png](c1.png)

## Rules
* Constructor name should be equal to class name.
* It doesn't have any return type.

Types of Constructors:
* Default constructor
* Parameterized constructor