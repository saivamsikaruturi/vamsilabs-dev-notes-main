# TypeScript

## Why TypeScript Matters

TypeScript is a strongly-typed superset of JavaScript that compiles to plain JavaScript. It has become the industry standard for large-scale frontend and backend applications.

**Key Benefits:**

- **Type Safety** — Catches errors at compile time rather than runtime
- **Developer Productivity** — IntelliSense, autocompletion, and refactoring support
- **Self-Documenting Code** — Types serve as living documentation
- **Scalability** — Makes large codebases manageable with contracts between modules
- **Ecosystem** — First-class support in React, Angular, Node.js, and most modern frameworks

---

## Type System Basics

### Primitive Types

```typescript
let isDone: boolean = false;
let age: number = 30;
let name: string = "Alice";
let nothing: null = null;
let notDefined: undefined = undefined;
let id: symbol = Symbol("id");
let big: bigint = 100n;
```

### Arrays and Tuples

```typescript
// Arrays
let numbers: number[] = [1, 2, 3];
let names: Array<string> = ["Alice", "Bob"];

// Tuples — fixed-length arrays with specific types per index
let pair: [string, number] = ["age", 30];
let triple: [number, string, boolean] = [1, "hello", true];

// Named tuples (for readability)
type HttpResponse = [status: number, body: string];
```

### Enums

```typescript
// Numeric enum
enum Direction {
  Up = 0,
  Down = 1,
  Left = 2,
  Right = 3,
}

// String enum (preferred for debugging)
enum Status {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
  Pending = "PENDING",
}

// const enum — inlined at compile time (no runtime object)
const enum Color {
  Red = "RED",
  Green = "GREEN",
  Blue = "BLUE",
}
```

### Type Inference

TypeScript infers types when you don't annotate explicitly:

```typescript
let x = 10;           // inferred as number
let arr = [1, 2, 3]; // inferred as number[]
let obj = { a: 1 };  // inferred as { a: number }

// Return type inferred
function add(a: number, b: number) {
  return a + b; // return type inferred as number
}
```

### Union Types, Intersection Types, Literal Types

```typescript
// Union — value can be one of several types
type ID = string | number;

function printId(id: ID) {
  if (typeof id === "string") {
    console.log(id.toUpperCase());
  } else {
    console.log(id);
  }
}

// Intersection — combines multiple types
type HasName = { name: string };
type HasAge = { age: number };
type Person = HasName & HasAge; // must have both name and age

// Literal types — exact values as types
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
type Port = 80 | 443 | 8080;
```

---

## Interfaces vs Types

| Feature | `interface` | `type` |
|---------|-------------|--------|
| Object shapes | Yes | Yes |
| Extends/inheritance | `extends` keyword | `&` intersection |
| Declaration merging | Yes (auto-merged) | No |
| Union types | No | Yes |
| Mapped types | No | Yes |
| Primitives/tuples | No | Yes |
| `implements` in classes | Yes | Yes (with limitations) |

```typescript
// Interface — best for object shapes and contracts
interface User {
  id: number;
  name: string;
  email: string;
}

interface Admin extends User {
  permissions: string[];
}

// Declaration merging — interfaces with same name merge
interface Window {
  customProperty: string;
}

// Type alias — best for unions, computed types, primitives
type Response = Success | Failure;
type Callback = (data: string) => void;
type Pair<T> = [T, T];
```

**Rule of thumb:** Use `interface` for public APIs and object shapes. Use `type` for unions, intersections, and computed types.

---

## Generics

### Generic Functions

```typescript
function identity<T>(arg: T): T {
  return arg;
}

const num = identity<number>(42);
const str = identity("hello"); // type inferred as string

// Multiple type parameters
function map<T, U>(arr: T[], fn: (item: T) => U): U[] {
  return arr.map(fn);
}
```

### Generic Classes

```typescript
class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }
}

const numberStack = new Stack<number>();
numberStack.push(1);
numberStack.push(2);
```

### Generic Constraints

```typescript
interface HasLength {
  length: number;
}

function logLength<T extends HasLength>(arg: T): T {
  console.log(arg.length);
  return arg;
}

logLength("hello");     // OK — string has length
logLength([1, 2, 3]);   // OK — array has length
// logLength(123);      // Error — number has no length

// keyof constraint
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

### Utility Types

```typescript
interface Todo {
  title: string;
  description: string;
  completed: boolean;
}

// Partial — all properties optional
type PartialTodo = Partial<Todo>;

// Required — all properties required
type RequiredTodo = Required<Todo>;

// Pick — select specific properties
type TodoPreview = Pick<Todo, "title" | "completed">;

// Omit — exclude specific properties
type TodoWithoutDesc = Omit<Todo, "description">;

// Record — construct an object type
type PageInfo = Record<string, { title: string; url: string }>;

// Readonly — all properties readonly
type ReadonlyTodo = Readonly<Todo>;

// ReturnType — extract return type of a function
type Result = ReturnType<typeof JSON.parse>; // any

// Parameters — extract parameter types
type Params = Parameters<typeof setTimeout>; // [callback, ms?, ...args[]]
```

---

## Advanced Types

### Conditional Types

```typescript
type IsString<T> = T extends string ? "yes" : "no";

type A = IsString<string>;  // "yes"
type B = IsString<number>;  // "no"

// Distributive conditional types
type NonNullable<T> = T extends null | undefined ? never : T;
type C = NonNullable<string | null | undefined>; // string

// infer keyword — extract types from within other types
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type D = UnwrapPromise<Promise<string>>; // string

type ArrayElement<T> = T extends (infer U)[] ? U : never;
type E = ArrayElement<number[]>; // number
```

### Mapped Types

```typescript
// Create new types by transforming properties
type Optional<T> = {
  [K in keyof T]?: T[K];
};

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

// Key remapping with `as`
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface Person {
  name: string;
  age: number;
}

type PersonGetters = Getters<Person>;
// { getName: () => string; getAge: () => number }
```

### Template Literal Types

```typescript
type EventName = "click" | "focus" | "blur";
type Handler = `on${Capitalize<EventName>}`;
// "onClick" | "onFocus" | "onBlur"

type HTTPMethod = "GET" | "POST";
type APIRoute = "/users" | "/posts";
type Endpoint = `${HTTPMethod} ${APIRoute}`;
// "GET /users" | "GET /posts" | "POST /users" | "POST /posts"
```

### keyof and typeof

```typescript
// keyof — extracts keys as a union
interface Config {
  host: string;
  port: number;
  debug: boolean;
}
type ConfigKey = keyof Config; // "host" | "port" | "debug"

// typeof — extracts type from a value
const defaults = { host: "localhost", port: 3000 };
type Defaults = typeof defaults; // { host: string; port: number }

// Combined usage
function getSetting<K extends keyof Config>(key: K): Config[K] {
  // ...
}
```

---

## Classes

### Access Modifiers

```typescript
class Employee {
  public name: string;           // accessible everywhere
  protected department: string;  // accessible in class and subclasses
  private salary: number;        // accessible only in this class
  readonly id: number;           // cannot be reassigned after construction

  constructor(name: string, department: string, salary: number, id: number) {
    this.name = name;
    this.department = department;
    this.salary = salary;
    this.id = id;
  }
}

// Parameter properties — shorthand
class Employee2 {
  constructor(
    public name: string,
    protected department: string,
    private salary: number,
    readonly id: number
  ) {}
}
```

### Abstract Classes

```typescript
abstract class Shape {
  abstract area(): number;
  abstract perimeter(): number;

  describe(): string {
    return `Area: ${this.area()}, Perimeter: ${this.perimeter()}`;
  }
}

class Circle extends Shape {
  constructor(private radius: number) {
    super();
  }

  area(): number {
    return Math.PI * this.radius ** 2;
  }

  perimeter(): number {
    return 2 * Math.PI * this.radius;
  }
}
```

### Decorators (Stage 3 / TypeScript 5+)

```typescript
// Method decorator
function log(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = function (...args: any[]) {
    console.log(`Calling ${key} with`, args);
    return original.apply(this, args);
  };
}

class Calculator {
  @log
  add(a: number, b: number): number {
    return a + b;
  }
}
```

---

## Type Guards and Narrowing

```typescript
// typeof guard
function padLeft(value: string, padding: string | number): string {
  if (typeof padding === "number") {
    return " ".repeat(padding) + value;
  }
  return padding + value;
}

// instanceof guard
function logDate(date: Date | string): void {
  if (date instanceof Date) {
    console.log(date.toISOString());
  } else {
    console.log(date);
  }
}

// in operator
interface Fish { swim(): void }
interface Bird { fly(): void }

function move(animal: Fish | Bird) {
  if ("swim" in animal) {
    animal.swim();
  } else {
    animal.fly();
  }
}

// Custom type guard (type predicate)
function isString(value: unknown): value is string {
  return typeof value === "string";
}

// Assertion function
function assertDefined<T>(val: T | undefined | null): asserts val is T {
  if (val === undefined || val === null) {
    throw new Error("Value is not defined");
  }
}
```

---

## Async Patterns

```typescript
// Typed Promises
function fetchUser(id: number): Promise<User> {
  return fetch(`/api/users/${id}`).then((res) => res.json());
}

// async/await with proper typing
async function getUsers(): Promise<User[]> {
  const response = await fetch("/api/users");
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }
  return response.json() as Promise<User[]>;
}

// Generic async function
async function fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  return response.json() as Promise<T>;
}

const user = await fetchData<User>("/api/user/1");

// Concurrent execution with proper typing
async function loadDashboard(): Promise<[User, Post[], Comment[]]> {
  const [user, posts, comments] = await Promise.all([
    fetchData<User>("/api/user"),
    fetchData<Post[]>("/api/posts"),
    fetchData<Comment[]>("/api/comments"),
  ]);
  return [user, posts, comments];
}
```

---

## Module System

### ESM (ES Modules) — Preferred

```typescript
// Named exports
export interface User { id: number; name: string; }
export function createUser(name: string): User { /* ... */ }

// Default export
export default class UserService { /* ... */ }

// Importing
import UserService, { User, createUser } from "./user";
import type { User } from "./user"; // type-only import (erased at runtime)
```

### CommonJS Interop

```typescript
// CommonJS export
module.exports = { createUser };

// TypeScript import of CJS module
import createUser = require("./user");

// Or with esModuleInterop enabled in tsconfig:
import createUser from "./user";
```

**Key difference:** ESM uses static imports (tree-shakeable, analyzed at compile time). CommonJS uses dynamic `require()` (evaluated at runtime).

---

## tsconfig.json Key Options

```json
{
  "compilerOptions": {
    "target": "ES2022",           // JS version to compile to
    "module": "ESNext",           // Module system (ESNext, CommonJS, NodeNext)
    "lib": ["ES2022", "DOM"],     // Available type declarations
    "strict": true,               // Enables all strict checks (recommended)
    "esModuleInterop": true,      // Allows default imports from CJS modules
    "skipLibCheck": true,         // Skip .d.ts checking (faster builds)
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,    // Allow importing .json files
    "declaration": true,          // Generate .d.ts files
    "declarationMap": true,       // Source maps for declarations
    "sourceMap": true,            // Generate source maps
    "outDir": "./dist",           // Output directory
    "rootDir": "./src",           // Root source directory
    "baseUrl": ".",               // Base for path resolution
    "paths": {                    // Path aliases
      "@/*": ["src/*"]
    },
    "noUnusedLocals": true,       // Error on unused variables
    "noUnusedParameters": true,   // Error on unused parameters
    "noImplicitReturns": true     // Error on missing return statements
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**`strict: true` enables:** `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`.

---

## Common Patterns

### Discriminated Unions

```typescript
// The "kind" property acts as a discriminant
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "triangle"; base: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "rectangle":
      return shape.width * shape.height;
    case "triangle":
      return 0.5 * shape.base * shape.height;
  }
}

// Exhaustiveness checking with never
function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}
```

### Builder Pattern with Types

```typescript
class QueryBuilder<T extends Record<string, unknown>> {
  private filters: Partial<T> = {};
  private sortField?: keyof T;
  private limitCount?: number;

  where<K extends keyof T>(field: K, value: T[K]): this {
    this.filters[field] = value;
    return this;
  }

  orderBy(field: keyof T): this {
    this.sortField = field;
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  build(): { filters: Partial<T>; sort?: keyof T; limit?: number } {
    return { filters: this.filters, sort: this.sortField, limit: this.limitCount };
  }
}

interface User { id: number; name: string; age: number; }

const query = new QueryBuilder<User>()
  .where("age", 25)
  .orderBy("name")
  .limit(10)
  .build();
```

### Type-Safe Event Emitter

```typescript
type EventMap = {
  login: { userId: string; timestamp: Date };
  logout: { userId: string };
  error: { message: string; code: number };
};

class TypedEmitter<T extends Record<string, any>> {
  private listeners: { [K in keyof T]?: Array<(payload: T[K]) => void> } = {};

  on<K extends keyof T>(event: K, listener: (payload: T[K]) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
  }

  emit<K extends keyof T>(event: K, payload: T[K]): void {
    this.listeners[event]?.forEach((fn) => fn(payload));
  }
}

const emitter = new TypedEmitter<EventMap>();
emitter.on("login", (data) => {
  console.log(data.userId); // fully typed
});
emitter.emit("login", { userId: "123", timestamp: new Date() });
```

---

## Interview Questions

??? question "What is the difference between `any`, `unknown`, and `never`?"
    - **`any`** — disables type checking entirely. Assignable to and from everything. Avoid in production code.
    - **`unknown`** — the type-safe counterpart of `any`. You must narrow it before using it (via type guards, assertions, etc.).
    - **`never`** — represents values that never occur. Used for exhaustiveness checking, functions that never return (infinite loops, always throw), and impossible intersections like `string & number`.

??? question "Explain structural typing vs nominal typing in TypeScript."
    TypeScript uses **structural typing** (duck typing) — two types are compatible if their shapes match, regardless of their declared names. This means:
    ```typescript
    interface Point { x: number; y: number; }
    interface Coordinate { x: number; y: number; }
    // Point and Coordinate are interchangeable
    ```
    Nominal typing (used in Java/C#) requires explicit declarations. To simulate nominal types in TS, use branded types:
    ```typescript
    type USD = number & { __brand: "USD" };
    type EUR = number & { __brand: "EUR" };
    ```

??? question "What is declaration merging and when is it useful?"
    Declaration merging is when the compiler merges two separate declarations with the same name into a single definition. It works with `interface` (not `type`). It is useful for:

    - Extending third-party library types without modifying source
    - Adding properties to global objects (Window, NodeJS.Process)
    - Module augmentation for plugins

    ```typescript
    interface Express.Request {
      user?: User; // adds 'user' to all Request objects
    }
    ```

??? question "How do conditional types work with `infer`?"
    Conditional types follow the pattern `T extends U ? X : Y`. The `infer` keyword declares a type variable within the `extends` clause that can be used in the true branch:
    ```typescript
    type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
    type Flatten<T> = T extends Array<infer U> ? U : T;
    ```
    `infer` lets you "extract" a type from a complex structure without knowing it ahead of time. It only works inside the `extends` clause of conditional types.

??? question "What are the differences between `interface extends` and type intersection (`&`)?"
    - **`extends`** creates a subtype relationship and gives clear error messages on conflicts.
    - **`&` intersection** merges types but conflicting properties become `never` silently.
    - `extends` is checked eagerly; intersections are resolved lazily.
    - Interfaces support declaration merging; type intersections do not.
    - For performance: deeply nested interfaces compile faster than deeply nested intersections.

??? question "Explain covariance and contravariance in TypeScript."
    - **Covariance** — `A extends B` means `Array<A>` is assignable to `Array<B>`. TypeScript arrays are covariant (in their element type).
    - **Contravariance** — function parameters are contravariant under `strictFunctionTypes`. If `Dog extends Animal`, then `(animal: Animal) => void` is assignable to `(dog: Dog) => void`, NOT the reverse.
    - This ensures type safety: a function expecting to handle any Animal shouldn't be restricted to only Dogs.

??? question "How would you make a type that requires at least one property from an interface?"
    ```typescript
    type AtLeastOne<T, Keys extends keyof T = keyof T> =
      Pick<T, Exclude<keyof T, Keys>> &
      { [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>> }[Keys];

    interface Filters {
      name?: string;
      age?: number;
      email?: string;
    }

    type ValidFilter = AtLeastOne<Filters>;
    // Must provide at least one of name, age, or email
    ```
    A simpler approach uses discriminated unions or overloaded function signatures for common cases.

??? question "What is the purpose of `satisfies` in TypeScript 4.9+?"
    The `satisfies` operator validates that an expression matches a type without widening or changing the inferred type:
    ```typescript
    type Colors = Record<string, [number, number, number] | string>;

    const palette = {
      red: [255, 0, 0],
      green: "#00ff00",
    } satisfies Colors;

    // palette.red is still inferred as [number, number, number] (not widened to the union)
    palette.red.map((c) => c * 2); // OK — array methods available
    ```
    Without `satisfies`, annotating as `Colors` would lose the specific tuple type. `satisfies` gives you both validation AND precise inference.
