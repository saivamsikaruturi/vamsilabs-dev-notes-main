## Wrapper Classes

* byte,int,short,char,boolean,long,float,double.
* To wrap primitive into object form so that we can handle primitive just like objects.
* Student s=new Student();
  s.getMarks();
  s.getInfo();
* To define several utility methods for primitive.
  ex: 10 to string
  String s = Integer.toString(10);

**AutoBoxing and Auto UnBoxing:**

* Introduced in 1.5 version.
* In 1.4 version we cannot provide primitive value in place of wrapper object and in place of wrapper object we cannot provide wrapper object.
* ArrayList l=new ArrayList();
* l.add(10);
* Boolean b=new Boolean(true)
  if(b){
  }
* This automatic conversion from primitive to Object is called as AutoBoxing and object to primitive is called AutoUnboxing.

    
      
         int autoBoxing=123;

         System.out.println(Integer.valueOf(autoBoxing));
    
         Integer autoUnBoxing = new Integer (23);
    
         System.out.println(autoUnBoxing.intValue ());
    
      String num = "123";
    
      int i = Integer.parseInt(num);

      System.out.println(i);

      Integer num1=123;

      String s1 = num1.toString ();
    
      System.out.println (s1);