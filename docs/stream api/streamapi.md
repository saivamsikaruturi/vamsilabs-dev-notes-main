Java 8 Stream Intermediate And Terminal Operations

1) The main difference between intermediate and terminal operations is that intermediate operations return a stream as a result and terminal operations return non-stream values like primitive or object or collection or may not return anything.

2) As intermediate operations return another stream as a result, they can be chained together to form a pipeline of operations. Terminal operations can not be chained together.

3) Pipeline of operations may contain any number of intermediate operations, but there has to be only one terminal operation, that too at the end of pipeline.

4) Intermediate operations are lazily loaded. When you call intermediate operations, they are actually not executed. They are just stored in the memory and executed when the terminal operation is called on the stream.

5) As the names suggest, intermediate operations doesn’t give end result. They just transform one stream to another stream. On the other hand, terminal operations give end result.

6)**Intermediate Operations :**

map(),filter(),distinct(),sorted(),limit(),skip()

**Terminal Operations :**

forEach(),toArray(),reduce(),collect(),min(),max(),count(),anyMatch(),allMatch(),noneMatch(),findFirst(),findAny()

**STREAM API CODING QUESTIONS :**

**1. get max and min value**

      Integer maxValue = Arrays.asList(20, 10, 4, 5, 1000).stream ().max (Comparator.*comparing* (Integer::*valueOf*)).get ();
      System.out.println (maxValue);

      Integer minValue = Arrays.asList (20, 10, 4, 5, 1000).stream ().min (Comparator.*comparing* (Integer::*valueOf*)).get ();
      System.out.println (minValue);

**2. Sorting in natural order**

     List<Integer> sortAsc = Arrays.asList (20, 10, 15, 40, 674, 455, 27, 14).stream ().sorted (Comparator.*naturalOrder* ()).collect (*toList* ());
     System.out.println (sortAsc);

**3. Sorting in reverse order**

    List<Integer> sortDesc = Arrays.asList (20, 10, 15, 40, 674, 455, 27, 14).stream ().sorted (Comparator.*reverseOrder* ()).collect (*toList* ());
    System.out.println (sortDesc);

**4. Limit the given the list** 

    Arrays.asList (20, 10, 4, 5, 1000, 8, 9, 7).stream ().limit (5).forEach (System.out::println);

**1. count the no .of elements in a list**

      long count = Arrays.asList (2018 - 05 - 31, 2022 - 05 - 30, 2026 - 05 - 29, 2030 - 05 - 27, 2033 - 03 - 07, 2018 - 06 - 10, 2022 - 06 - 11, 2026 - 06 - 11, 2030 - 06 - 12, 2033 - 03 - 13, 2018 - 03 - 19, 2022 - 02 - 18, 2026 - 01 - 01).stream ().count ();
      System.out.println (count);

**6. sum all the elements in the list**

    List<Integer> numbersList = Arrays.asList (1, 7, 8, 9, 5, 2, 36, 4, 78, 222, 24, 9, 2);

    int sum = numbersList.stream ().mapToInt (number -> number.intValue ()).sum ();
    System.out.println (sum);

**7. average of all the elements in the list**

    Double average = numbersList.stream ().mapToDouble (numbers-> numbers.doubleValue ()).average ().getAsDouble ();
    Double asDouble = numbersList.stream ().map (number -> number * number).filter (greater -> greater > 1000).mapToDouble (greaterThanThousand -> greaterThanThousand.doubleValue ()).average ().getAsDouble ();
    System.out.println (average);
    System.out.println (asDouble)

**8. get even elements in the list**

    List<Integer> evenNumbers = numbersList.stream ().filter (list -> list% 2 == 0).collect (*toList* ());
    System.out.println (evenNumbers);

**9. get odd elements in the list**

    List<Integer> oddNumbers = numbersList.stream ().filter (list -> list% 3 == 0).collect (*toList* ());
    System.out.println (oddNumbers);

**10. get elements starts with "2" in the list**

     List<String> elementsStartsWithTwo = numbersList.stream ().map (list -> list + **""**).filter (element -> element.startsWith (**"2"**)).collect (*toList* ());
     System.out.println (elementsStartsWithTwo);

**11. get non-unique or repeated elements in the list**

    Set<Integer> items = new HashSet<> ();
    List<Integer> repeatedElements = sum.stream ().filter (elements -> !items.add (elements)).collect (*toList* ());
    System.out.println (**"**repeatedElements::**"**+repeatedElements);


**12. get sum of first 5 elements in the list**

     Integer sumOfFirstFive = numbersList.stream ().limit (5).reduce ((x, y) -> (x + y)).get ();
     System.out.println (sumOfFirstFive);

**13. get sum by skipping first 5 elements in the list**

     Integer sumOfLastFive = numbersList.stream ().skip (5).reduce ((a, b) -> (a + b)).get ();
     System.out.println (sumOfLastFive);

**14. get cubes of all elements in the list**

     System.out.println (numbersList.stream ().map (cubes -> cubes * cubes * cubes).collect (*toList* ()));

     public class Employee{


    private Integer empId;
    private String empName;
    private Integer empAge;
    private String empGender;
    private String empDept;
    private LocalDate doj;
    private Integer salary;

    public Employee(Integer empId, String empName, Integer empAge, String empGender, String empDept, LocalDate doj, Integer salary) {
    this.empId = empId;
    this.empName = empName;
    this.empAge = empAge;
    this.empGender = empGender;
    this.empDept = empDept;
    this.doj = doj;
    this.salary = salary;
    }

    public Employee() {

    }

    public Integer getEmpId() {
    return empId;
    }

    public String getEmpName() {
    return empName;
    }

    public Integer getEmpAge() {
    return empAge;
    }

    public String getEmpGender() {
    return empGender;
    }

    public String getEmpDept() {
    return empDept;
    }

    public LocalDate getDoj() {
    return doj;
    }

    public Integer getSalary() {
    return salary;
    }

    @Override
    public String toString() {
    return "Employee{" +
            "empId=" + empId +
            ", empName='" + empName + '\\'' +
            ", empAge=" + empAge +
            ", empGender='" + empGender + '\\'' +
            ", empDept='" + empDept + '\\'' +
            ", doj='" + doj + '\\'' +
            ", salary=" + salary +
            '}';
    }

    @Override
    public boolean equals(Object o) {
    Employee e=(Employee) o;
    if(this.empId==e.empId && this.empName==e.empName)
        return true;
    else
        return false;
    }
    }


    Employee e = new Employee (46050451, "Sai Vamsi", 23, "Male", "Java", LocalDate.of (2020,12,15), 27000);
    Employee e1 = new Employee (46050452, "Vamsi", 24, "Male", "Java", LocalDate.of (2020,12,15), 27000);
    Employee e2 = new Employee (46050453, "Rashmi", 33, "Female", "Full Stack", LocalDate.of (2014,12,15), 120000);
    Employee e3 = new Employee (46050454, "Gayatri", 25, "Female", "Data Base", LocalDate.of (2017,01,01), 27000);
    Employee e4 = new Employee (46050455, "Need Smith", 28, "Male", "UI", LocalDate.of (2018,12,15), 70000);

    List<Employee> employeeList = Arrays.asList (e, e1, e2, e3, e4);
    

**15. get count of all Male employees in the list**

    long maleCount = employeeList.stream ().filter (emp -> emp.getEmpGender () == "Male").count();
    System.out.println (maleCount);

**16. get count of all Female employees in the list**

     long FemaleCount = employeeList.stream ().filter (emp -> emp.getEmpGender () == "Female").count ();
     System.out.println (FemaleCount);

**17. get all Departments in the list**

     List<String> departmentNames = employeeList.stream ().map (emp -> emp.getEmpDept ()).collect (*toList* ());
     System.out.println (departmentNames);

**18. get sum of age of all Male Employee in the list**
        
       Integer ageofMale = employeeList.stream ().filter (emp -> emp.getEmpGender () == "Male").map (age -> age.getEmpAge ()).reduce ((age1, age2) -> (age1 + age2)).get ();
       System.out.println (ageofMale);

**19. get average of age of all Female Employee in the list**
      
      Double ageofFemale = employeeList.stream ().filter (emp -> emp.getEmpGender () == "Female").map (age -> age.getEmpAge ()).mapToDouble (age1>age1.doubleValue ()).average ().getAsDouble ();
      System.out.println (ageofFemale);

**20. get salaries of all Employee in Higher order in the list**

    Employee highestSalary = employeeList.stream() .sorted(Comparator.*comparingDouble*(Employee::getSalary).reversed()).collect(*toList*()).get (0);
    System.out.println (highestSalary);

**21. get Employees joined after a particular date in the list**      
        
      String> employees = employeeList.stream ().filter (elist -> elist.getDoj ().isAfter (LocalDate.of (2017, 01, 01))).map (Employee::getEmpName).collect(*toList*());
      System.out.println (employees);

**22. get Employee who is small in age in the list**

    String youngEmployee = employeeList.stream ().sorted (Comparator.*comparing* (Employee::getEmpAge)).map (age1 -> age1.getEmpName ()).collect(*toList*()).get (0);
    System.out.println (youngEmployee);

**23. get Employee who age is less than 25 in the list**

     List<String> agelessthan25 = employeeList.stream ().filter (lessAge -> lessAge.getEmpAge() <= 25).map(Employee::getEmpName).collect(*toList*());
     System.out.println (agelessthan25);

**24. get 2nd Highest Salary in the list**

     Integer secondHighestSalary = employeeList.stream()  .sorted(Comparator.*comparingDouble*(Employee::getSalary).reversed()).map(eSalary > eSalary.getSalary ()).collect(*toList*()).get (1);
     System.out.println (secondHighestSalary); 
     int second= employeeList.stream().distinct().sorted(Comparator.reverseOrder()).skip(1).findFirst().get();

**25. Get the highest salary from each department**

     Map<String, Employee> collect3 = employeeList.stream ().collect (Collectors.groupingBy (Employee::getEmpDept, Collectors.collectingAndThen (Collectors.maxBy (Comparator.comparingInt (Employee::getSalary)), Optional::get)));*

**26. get Unique Characters from a String**

     String s=”java”;

     Arrays.*stream* (s.split ("")).collect(Collectors.groupingBy (Function.*identity* (),Collectors.*counting* ())).entrySet ().stream ().filter (e->e.getValue ()>1).forEach (System.out::println);

**27. get duplicates from a list**

      //duplicate elements
        Arrays.asList(1,2,4,5,2,6,1).stream().filter(e->!set.add(e)).forEach(System.out::print);

        // without set
        List<Integer> duplicates = Arrays.asList(1, 2, 4, 5, 2, 6, 1).stream()
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()))
                .entrySet().stream().filter(e -> e.getValue() > 1).map(e -> e.getKey()).collect(Collectors.toList());
      

**28. get unique elements from a list**
      
        List<Integer> unique = Arrays.asList(1, 2, 4, 5, 2, 6, 1).stream()
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()))
                .entrySet().stream().filter(e -> e.getValue() == 1).map(e -> e.getKey()).collect(Collectors.toList());
       

**29. get first non-repeated character from a string**

         Character character = s.chars().mapToObj(e -> (char) e).collect(Collectors.groupingBy(Function.identity(), LinkedHashMap::new, Collectors.counting()))
                .entrySet().stream().filter(e -> e.getValue() == 1).map(e -> e.getKey()).findFirst().orElse(null);

**30.get first repeated character from a string**

        Character character = s.chars().mapToObj(e -> (char) e).collect(Collectors.groupingBy(Function.identity(), LinkedHashMap::new, Collectors.counting()))
                .entrySet().stream().filter(e -> e.getValue() >1).map(e -> e.getKey()).findFirst().orElse(null);
       