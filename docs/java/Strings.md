

* String is a sequence of individual character.
    


      String s1 = "ABC";
      String s2 = new String("XYZ");

![Strings11.PNG](Strings11.PNG)

## Why Strings are Immutable?

     String s1  = "ABC";
            s1  = "XYZ";
     String s2  = "ABC";
   
![Strings22.PNG](Strings22.PNG)

* When the existing string ref is changed, it will not change the existing object, and it will create a new literal and "S1" points to the new literal.
* If we create a new String literal s2 with "ABC", As ABC literal is available S2 points to ABC.

   
## == and .equals

![Strings33.PNG](Strings33.PNG)

    String s1 = "ABC";
    String s2 = "ABC";

* == operator for address comparison.
* .equals for value comparison.

      s1 == s2  ---> true

* Because s1 and s2 points to the same address.

         String s3 = "ABC";
         String s4 = new String("ABC");

         s3 == s4 --> false
         s3.equals(s4) ---> true
         s1 == s3 ---> true
         s3 == s2 ---> true
         s2 == s4 ---> false



## Advantages of Immutability

1.Saving Heap Space

2.Good for HashMap Key

3.password and username

4.good for multiple thread operation , Thread safe.

  Even if some thread modifies the value, an entirely new String is created without affecting the original one.


## Difference between String ,String Buffer and String Builder

| String | String Buffer | String Builder |
| --- | --- | --- |
| Immutable | Mutable | Mutable |
| Intialization is mandatory | Not mandatory | Not mandatory |
| Synchronized | Synchronized | Not Synchronized |
| Thread safe | Thread safe | Not Thread safe |
| Less performance | Less performance | Best Performance. Recommended while using Multi Threading |


## why char[] is preferred more than String while storing passwords?

* In Java, using char[] is often considered a better practice than using String for storing passwords because String objects are immutable, meaning they cannot be changed once created. This immutability poses a security risk when it comes to storing sensitive information like passwords.

* When a password is stored as a String, it remains in memory until it is garbage collected, and during this time, it can be accessed by other parts of the program. This makes it potentially vulnerable to unauthorized access and increases the chances of the password being inadvertently leaked.

* On the other hand, char[] arrays are mutable, and you can manually overwrite the contents of the array after using it, ensuring that the password is no longer present in memory. By explicitly clearing the array after using the password, you reduce the window of opportunity for an attacker to retrieve the password from memory.

        char[] password = {'s', 'e', 'c', 'r', 'e', 't'};

        // Use the password...
 
        // Clear the password from memory
      
        Arrays.fill(password, '\0');

* By using char[] instead of String, you have more control over the lifespan of the password in memory, minimizing the chances of it being exposed to potential attackers. 

* However, it's worth noting that this approach does not completely eliminate the risks associated with password storage, and it's essential to follow other security best practices such as hashing and salting passwords before storing them.

## Rules For Creating Immutable Class

1.Make the class as final.

2.make the variables as private and final

3.create a constructor

4.only getters no setters

    import java.util.ArrayList;
    import java.util.List;

    public final class Immutable {
    private int id;
    private String name;
    private List<String hobbies;

    public int getId() {
        return id;
    }

    public String getName() {
        return name;
    }
    
    public List<String getHobbies() {
       List<String objects = new ArrayList< ();
        for(String hobby:hobbies){
            objects.add(hobby);
        }
        return objects;
    }

    @Override
    public String toString() {
        return "Immutable{" +
                "id=" + id +
                ", name='" + name + '\'' +
                ", hobbies=" + hobbies +
                '}';
    }

    public Immutable(int id, String name, List<String hobbyList) {
        this.id = id;
        this.name = name;
        this.hobbies = new ArrayList< ();
        for(String hobby: hobbyList){
            hobbies.add(hobby);
        }

    }

    public static void main(String[] args) {
        List<Stringh=new ArrayList< ();
        h.add("cycling");
        h.add("music");
        Immutable immutable=new Immutable (1,"Sai",h);
        h.add ("test");
        System.out.println (immutable);

    }
    }