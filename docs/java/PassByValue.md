---
title: "Pass-by-Value in Java — Java Interview Guide (2026)"
description: "subgraph HEAP[\"Heap\"] direction TB H1[\"Dog: 'Rex'@ 0x1234\"] end"
---

# Pass-by-Value in Java

> "Java is **ALWAYS** pass-by-value. Period. The confusion is about **WHAT** is passed."
> — James Gosling, creator of Java

---

!!! danger "Interview Trap: This Question Has Ended Interviews"
    A senior engineer candidate at a FAANG company was asked: *"Is Java pass-by-value or pass-by-reference?"* They confidently answered: "Java passes objects by reference." **Rejected.** The interviewer probed further — the candidate couldn't explain why `swap(a, b)` doesn't work in Java. This one misconception signaled a fundamental gap in understanding how Java's memory model works. Don't be that candidate.

---

## The Fundamental Truth

```mermaid
flowchart TB
    subgraph STACK["Stack"]
        direction TB
        S1["myDog = 0x1234"]
        S2["dog = 0x1234<br/>(COPY)"]
    end

    subgraph HEAP["Heap"]
        direction TB
        H1["Dog: 'Rex'<br/>@ 0x1234"]
    end

    S1 ==>|"copies ref"| S2
    S1 -.->|"points to"| H1
    S2 -.->|"same object"| H1

    style STACK fill:#EFF6FF,stroke:#93C5FD,stroke-width:2px,color:#1E40AF
    style HEAP fill:#ECFDF5,stroke:#6EE7B7,stroke-width:2px,color:#065F46
    style S1 fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style S2 fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style H1 fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
```

**Key insight:** Java copies the VALUE stored in the variable. For primitives, that value IS the data. For objects, that value is a REFERENCE (memory address) — not the object itself.

---

## The Golden Rule

!!! info "The Golden Rule of Java Parameter Passing"
    Java **always** passes a **COPY** of the value stored in the variable:

    - **Primitives** → copy of the actual data (42, 3.14, true)
    - **Object references** → copy of the memory address (pointer to the object)
    
    You NEVER get direct access to the caller's variable. You get your own local copy.

```mermaid
flowchart LR
    subgraph PRIMITIVE["Primitive: int x"]
        direction LR
        P1["x = 42"] ==>|"copies 42"| P2["param = 42"]
        P3["Independent copies"]
    end

    subgraph REFERENCE["Object: Dog d"]
        direction LR
        R1["d = 0xABC"] ==>|"copies addr"| R2["param = 0xABC"]
        R3["2 refs, 1 object"]
    end

    style PRIMITIVE fill:#FFFBEB,stroke:#FCD34D,stroke-width:2px,color:#92400E
    style REFERENCE fill:#EFF6FF,stroke:#93C5FD,stroke-width:2px,color:#1E40AF
    style P1 fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style P2 fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style P3 fill:#FFFBEB,stroke:#FCD34D,color:#92400E
    style R1 fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style R2 fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style R3 fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
```

---

## Case 1: Primitives

Primitives are simple — the value is copied, modifications are completely independent.

```java
public class PrimitiveDemo {
    public static void modify(int num) {
        num = 100;  // Only modifies LOCAL copy
        System.out.println("Inside method: " + num);  // 100
    }

    public static void main(String[] args) {
        int x = 42;
        modify(x);
        System.out.println("After method: " + x);  // Still 42!
    }
}
```

**Output:**
```
Inside method: 100
After method: 42
```

```mermaid
flowchart LR
    subgraph BEFORE["Before"]
        B1["x = 42"]
    end

    subgraph DURING["During"]
        D1["x = 42"]
        D2["num = 100"]
    end

    subgraph AFTER["After"]
        A1["x = 42"]
        A2["frame destroyed"]
    end

    BEFORE ==> DURING ==> AFTER

    style BEFORE fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
    style DURING fill:#FFFBEB,stroke:#FCD34D,color:#92400E
    style AFTER fill:#ECFDF5,stroke:#6EE7B7,color:#065F46
    style B1 fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style D1 fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style D2 fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style A1 fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style A2 fill:#FEE2E2,stroke:#FCA5A5,color:#991B1B
```

---

## Case 2: Object References

This is where the confusion lives. You pass a **copy of the reference**, not a copy of the object.

### Modifying the object WORKS (both references point to same object)

```java
public class ObjectModifyDemo {
    public static void rename(Dog dog) {
        dog.setName("Buddy");  // Modifies the SHARED object
    }

    public static void main(String[] args) {
        Dog myDog = new Dog("Rex");
        rename(myDog);
        System.out.println(myDog.getName());  // "Buddy" — change IS visible!
    }
}
```

**Output:**
```
Buddy
```

### Reassigning the reference DOES NOT affect the caller

```java
public class ObjectReassignDemo {
    public static void reassign(Dog dog) {
        dog = new Dog("Completely New Dog");  // Only reassigns LOCAL copy
        System.out.println("Inside: " + dog.getName());  // "Completely New Dog"
    }

    public static void main(String[] args) {
        Dog myDog = new Dog("Rex");
        reassign(myDog);
        System.out.println("After: " + myDog.getName());  // Still "Rex"!
    }
}
```

**Output:**
```
Inside: Completely New Dog
After: Rex
```

```mermaid
flowchart TB
    subgraph STEP1["Step 1: Before"]
        direction LR
        subgraph ST1["Stack"]
            S1A["myDog = 0x100"]
        end
        subgraph HP1["Heap"]
            H1A["Dog: 'Rex'<br/>@ 0x100"]
        end
        S1A -.-> H1A
    end

    subgraph STEP2["Step 2: Copied"]
        direction LR
        subgraph ST2["Stack"]
            S2A["myDog = 0x100"]
            S2B["dog = 0x100"]
        end
        subgraph HP2["Heap"]
            H2A["Dog: 'Rex'<br/>@ 0x100"]
        end
        S2A -.-> H2A
        S2B -.-> H2A
    end

    subgraph STEP3["Step 3: Reassigned"]
        direction LR
        subgraph ST3["Stack"]
            S3A["myDog = 0x100"]
            S3B["dog = 0x200"]
        end
        subgraph HP3["Heap"]
            H3A["Dog: 'Rex'<br/>@ 0x100"]
            H3B["Dog: 'New'<br/>@ 0x200"]
        end
        S3A -.-> H3A
        S3B -.-> H3B
    end

    STEP1 ==> STEP2 ==> STEP3

    style ST1 fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
    style ST2 fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
    style ST3 fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
    style HP1 fill:#ECFDF5,stroke:#6EE7B7,color:#065F46
    style HP2 fill:#ECFDF5,stroke:#6EE7B7,color:#065F46
    style HP3 fill:#ECFDF5,stroke:#6EE7B7,color:#065F46
    style S1A fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style S2A fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style S2B fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style S3A fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style S3B fill:#FEE2E2,stroke:#FCA5A5,color:#991B1B
    style H1A fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style H2A fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style H3A fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style H3B fill:#FEE2E2,stroke:#FCA5A5,color:#991B1B
```

!!! tip "The Leash Analogy"
    Think of an object reference as a **leash** attached to a dog (object). When you pass it to a method, you give them a **copy of the leash** — not the dog, and not your original leash.
    
    - They can **pull the leash** to rename the dog (modify the object) — you'll see it.
    - They can **drop their leash and grab a new one** attached to a different dog (reassign) — your leash is unaffected.

---

## Case 3: The String Special Case

Strings **appear** to be "passed by value" because they are **immutable**. Every "modification" creates a new String object.

```java
public class StringDemo {
    public static void modify(String s) {
        s = s + " World";  // Creates NEW String, reassigns local reference
        System.out.println("Inside: " + s);  // "Hello World"
    }

    public static void main(String[] args) {
        String greeting = "Hello";
        modify(greeting);
        System.out.println("After: " + greeting);  // Still "Hello"
    }
}
```

**Output:**
```
Inside: Hello World
After: Hello
```

```mermaid
flowchart TB
    subgraph STACK["Stack"]
        S1["greeting = 0x50"]
        S2["s = 0x50 then 0x70"]
    end

    subgraph HEAP["Heap (String Pool)"]
        H1["'Hello' @ 0x50<br/>immutable"]
        H2["'Hello World'<br/>@ 0x70 (new)"]
    end

    S1 -.->|"unchanged"| H1
    S2 -.->|"after concat"| H2

    style STACK fill:#EFF6FF,stroke:#93C5FD,stroke-width:2px,color:#1E40AF
    style HEAP fill:#FFFBEB,stroke:#FCD34D,stroke-width:2px,color:#92400E
    style S1 fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style S2 fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style H1 fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style H2 fill:#FEE2E2,stroke:#FCA5A5,color:#991B1B
```

!!! warning "Why Strings Seem Different"
    Strings are NOT a special case of parameter passing. The rules are identical to any object. The difference is that String is **immutable** — there's no `setChar()` method. Any "modification" creates a new object and reassigns the local reference. Since reassignment doesn't affect the caller, it **looks** like pass-by-value of the data.

---

## Case 4: Arrays

Arrays are objects, so the same rules apply: you pass a copy of the reference.

```java
public class ArrayDemo {
    // Modification: VISIBLE to caller
    public static void modifyElement(int[] arr) {
        arr[0] = 999;  // Modifies shared array object
    }

    // Reassignment: NOT visible to caller
    public static void reassignArray(int[] arr) {
        arr = new int[]{100, 200, 300};  // Local reassignment only
    }

    public static void main(String[] args) {
        int[] numbers = {1, 2, 3};

        modifyElement(numbers);
        System.out.println(numbers[0]);  // 999 — modification visible!

        reassignArray(numbers);
        System.out.println(numbers[0]);  // Still 999 — reassignment invisible
    }
}
```

**Output:**
```
999
999
```

---

## Case 5: The Swap Test (Classic Proof)

This is the **definitive proof** that Java is not pass-by-reference. If Java were pass-by-reference, a swap method would work.

```java
public class SwapTest {
    public static void swap(Dog a, Dog b) {
        Dog temp = a;
        a = b;       // Only reassigns LOCAL copy of reference
        b = temp;    // Only reassigns LOCAL copy of reference
    }

    public static void main(String[] args) {
        Dog dog1 = new Dog("Rex");
        Dog dog2 = new Dog("Buddy");

        swap(dog1, dog2);

        System.out.println(dog1.getName());  // "Rex"   — NOT swapped!
        System.out.println(dog2.getName());  // "Buddy" — NOT swapped!
    }
}
```

**Output:**
```
Rex
Buddy
```

```mermaid
flowchart TB
    subgraph BEFORE["Before swap()"]
        direction LR
        subgraph SB["Stack"]
            SB1["dog1 = 0x100"]
            SB2["dog2 = 0x200"]
        end
        subgraph HB["Heap"]
            HB1["'Rex' @ 0x100"]
            HB2["'Buddy' @ 0x200"]
        end
        SB1 -.-> HB1
        SB2 -.-> HB2
    end

    subgraph DURING["After swap logic"]
        direction LR
        subgraph SD["Stack"]
            SD1["dog1 = 0x100"]
            SD2["dog2 = 0x200"]
            SD3["a = 0x200"]
            SD4["b = 0x100"]
        end
        subgraph HD["Heap"]
            HD1["'Rex' @ 0x100"]
            HD2["'Buddy' @ 0x200"]
        end
        SD1 -.-> HD1
        SD2 -.-> HD2
        SD3 -.-> HD2
        SD4 -.-> HD1
    end

    subgraph AFTER["After return"]
        direction LR
        subgraph SA["Stack"]
            SA1["dog1 = 0x100"]
            SA2["dog2 = 0x200"]
        end
        subgraph HA["Heap"]
            HA1["'Rex' @ 0x100"]
            HA2["'Buddy' @ 0x200"]
        end
        SA1 -.-> HA1
        SA2 -.-> HA2
    end

    BEFORE ==> DURING ==> AFTER

    style SB fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
    style SD fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
    style SA fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
    style HB fill:#ECFDF5,stroke:#6EE7B7,color:#065F46
    style HD fill:#ECFDF5,stroke:#6EE7B7,color:#065F46
    style HA fill:#ECFDF5,stroke:#6EE7B7,color:#065F46
    style SB1 fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style SB2 fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style SD1 fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style SD2 fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style SD3 fill:#FEE2E2,stroke:#FCA5A5,color:#991B1B
    style SD4 fill:#FEE2E2,stroke:#FCA5A5,color:#991B1B
    style SA1 fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style SA2 fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style HB1 fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style HB2 fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style HD1 fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style HD2 fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style HA1 fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style HA2 fill:#FEF3C7,stroke:#FCD34D,color:#92400E
```

!!! danger "The Swap Test is the Killer Argument"
    In C++ with true pass-by-reference (`void swap(Dog& a, Dog& b)`), the swap WORKS because `a` and `b` ARE the original variables. In Java, `a` and `b` are LOCAL COPIES of the references — swapping them only swaps the copies. The originals are untouched.

---

## Comparison with Other Languages

| Feature | Java | C++ (by reference) | C# (ref keyword) |
|---------|------|---------------------|-------------------|
| Syntax | `void foo(Dog d)` | `void foo(Dog& d)` | `void foo(ref Dog d)` |
| What is passed | Copy of reference | Alias to original variable | Alias to original variable |
| Modify object | Visible to caller | Visible to caller | Visible to caller |
| Reassign parameter | NOT visible | IS visible | IS visible |
| Swap works? | **NO** | **YES** | **YES** |
| Pass-by-value? | **Always** | No (when using &) | No (when using ref) |

### C++ True Pass-by-Reference

```cpp
// C++ — this actually swaps! Java CANNOT do this.
void swap(Dog& a, Dog& b) {  // & means a IS the original variable
    Dog temp = a;
    a = b;     // Modifies caller's variable directly
    b = temp;  // Modifies caller's variable directly
}
```

### C# ref Keyword

```csharp
// C# — explicit opt-in to pass-by-reference
void Reassign(ref Dog d) {
    d = new Dog("New");  // Caller WILL see this change
}

Dog myDog = new Dog("Rex");
Reassign(ref myDog);
Console.WriteLine(myDog.Name);  // "New" — reassignment visible!
```

Java has **no equivalent** of C++'s `&` or C#'s `ref`. You cannot make the caller's variable point to a different object from within a method. Ever.

---

## Complete Memory Walkthrough

```mermaid
sequenceDiagram
    participant M as main
    participant F as method
    participant H as heap

    rect rgba(219, 234, 254, 0.3)
        Note over M,H: Phase 1: Setup
        M->>H: new Dog("Rex") @ 0x100
    end

    rect rgba(254, 243, 199, 0.3)
        Note over M,H: Phase 2: Modify via ref
        M->>F: copy ref (0x100)
        F->>H: setName("Buddy")
        Note over H: Rex becomes Buddy
    end

    rect rgba(254, 226, 226, 0.3)
        Note over M,H: Phase 3: Reassign local
        F->>H: new Dog("Max") @ 0x200
        Note over F: dog = 0x200 (local)
        Note over M: myDog still 0x100
    end

    rect rgba(209, 250, 229, 0.3)
        Note over M,H: Phase 4: Return
        Note over F: frame destroyed
        Note over M: myDog = "Buddy"
        Note over H: 0x200 is garbage
    end
```

```java
public class FullDemo {
    public static void modifyAndReassign(Dog dog) {
        // Phase 2: Modification via shared reference
        dog.setName("Buddy");      // ✅ Caller WILL see this

        // Phase 3: Reassignment of local reference
        dog = new Dog("Max");      // ❌ Caller will NOT see this
        dog.setName("Charlie");    // ❌ Modifies new object, not caller's
    }

    public static void main(String[] args) {
        Dog myDog = new Dog("Rex");         // Phase 1
        modifyAndReassign(myDog);           // Phase 2-3
        System.out.println(myDog.getName()); // Phase 4: "Buddy"
    }
}
```

**Output:**
```
Buddy
```

---

## Common Misconceptions

| Misconception | Reality |
|---|---|
| "Java passes objects by reference" | Java passes a **copy of the reference** by value |
| "Primitives are pass-by-value, objects are pass-by-reference" | **Everything** is pass-by-value. Objects are never passed at all — only references to them |
| "I can write a swap method in Java" | You cannot. The swap test is the proof that Java is pass-by-value |
| "Strings are passed by value differently" | Strings follow the exact same rules. They just appear different because they're immutable |
| "Pass-by-reference means I can modify the object" | No! That's pass-by-value of a reference. Pass-by-reference means you can change what the caller's variable points to |
| "`final` parameters prevent modification" | `final` prevents reassignment of the local reference, but you can still modify the object it points to |

---

## Quick Recall Table

| Scenario | Visible to Caller? | Why? |
|----------|:---:|------|
| `param.setX(...)` (modify object) | **YES** | Both references point to same heap object |
| `param = new Foo()` (reassign) | **NO** | Only reassigns the local copy of reference |
| `param = otherObj` (reassign) | **NO** | Same as above — local copy only |
| `primitiveParam = 99` (modify primitive) | **NO** | Primitive was copied, independent stack slot |
| `arr[i] = val` (modify array element) | **YES** | Array is an object, both refs point to it |
| `arr = new int[]{...}` (reassign array) | **NO** | Reassigns local reference only |
| `str = str + "x"` (String concat) | **NO** | Creates new immutable String, reassigns local ref |
| `sb.append("x")` (StringBuilder) | **YES** | Modifies the shared mutable object |

---

## Interview Answer Template

!!! abstract "The One-Liner Answer"
    "Java always passes by value. For objects, the value IS the reference (memory address). You get a copy of that reference, not a copy of the object."

### Full Interview Answer (30-second version)

> "Java is strictly pass-by-value — there is no pass-by-reference mechanism in the language. When you pass a primitive, a copy of the data is made. When you pass an object, a copy of the **reference** (the pointer to the heap object) is made — not a copy of the object itself.
>
> This means you CAN modify the object's state through the copied reference, because both references point to the same heap object. But you CANNOT make the caller's reference point to a different object — reassignment only affects your local copy.
>
> The definitive proof is the swap test: you cannot write a working swap method in Java because you'd need true pass-by-reference to reassign the caller's variables."

### If the interviewer pushes back

> "The confusion comes from people equating 'I can modify the object' with 'pass-by-reference.' But those are different things. Pass-by-reference means the method receives an **alias** to the caller's variable itself — like C++'s `&` or C#'s `ref`. Java never does this. Java copies the value in the variable, and for objects, that value happens to be a reference."

---

## Edge Cases for Advanced Interviews

### Wrapper classes (Integer, Boolean, etc.)

```java
public static void modify(Integer num) {
    num = 200;  // Autoboxing creates NEW Integer object, reassigns local ref
}

Integer x = 100;
modify(x);
System.out.println(x);  // Still 100 — same as String case (immutable)
```

### Collections passed to methods

```java
public static void addElement(List<String> list) {
    list.add("new");  // ✅ Modifies shared list object — visible to caller
}

public static void replaceList(List<String> list) {
    list = new ArrayList<>();  // ❌ Local reassignment — invisible to caller
}
```

### Returning objects (not parameter passing, but often confused)

```java
public static Dog createDog() {
    Dog d = new Dog("Rex");  // Created on heap
    return d;  // Returns COPY of reference — object survives method exit
}
// Works fine because the heap object outlives the stack frame
```

---

## Summary Flowchart: Decision Guide

```mermaid
flowchart TD
    Q1{"What type?"}
    Q1 ==>|"Primitive"| A1["Copy of value<br/>Caller unaffected"]
    Q1 ==>|"Object ref"| Q2{"Method action?"}

    Q2 ==>|"obj.setX()"| A2["Caller sees it<br/>Same object"]
    Q2 ==>|"param = new"| A3["Caller can't see<br/>Local copy only"]
    Q2 ==>|"Both"| A4["Modify: visible<br/>Reassign: not"]

    style Q1 fill:#DBEAFE,stroke:#93C5FD,stroke-width:2px,color:#1E40AF
    style Q2 fill:#FEF3C7,stroke:#FCD34D,stroke-width:2px,color:#92400E
    style A1 fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style A2 fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style A3 fill:#FEE2E2,stroke:#FCA5A5,color:#991B1B
    style A4 fill:#FFFBEB,stroke:#FCD34D,color:#92400E
```

---

!!! success "Key Takeaway"
    If someone asks "Is Java pass-by-value or pass-by-reference?" — the answer is unambiguously **pass-by-value**. The subtlety is that for objects, the "value" being passed is a reference. But it's still a COPY of that reference, which is why reassignment never propagates back to the caller.
