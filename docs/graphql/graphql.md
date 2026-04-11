# GraphQL

## What is GraphQL?

GraphQL is a **query language for APIs** and a runtime for fulfilling those queries. Unlike REST, it lets the client specify exactly what data it needs.

| Feature | REST | GraphQL |
|---|---|---|
| Data fetching | Multiple endpoints | Single endpoint |
| Over-fetching | Common | Eliminated |
| Under-fetching | Common | Eliminated |
| Versioning | URL/header-based | Schema evolution |
| Type system | None (OpenAPI optional) | Built-in |
| Real-time | Polling / WebSockets | Subscriptions |

## Core Concepts

### Schema Definition Language (SDL)

```graphql
type User {
  id: ID!
  name: String!
  email: String!
  age: Int
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  createdAt: String!
}

type Query {
  user(id: ID!): User
  users(limit: Int, offset: Int): [User!]!
  post(id: ID!): Post
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deleteUser(id: ID!): Boolean!
}

input CreateUserInput {
  name: String!
  email: String!
  age: Int
}

input UpdateUserInput {
  name: String
  email: String
  age: Int
}
```

### Queries

Fetch exactly the data you need:

```graphql
query GetUser {
  user(id: "123") {
    name
    email
    posts {
      title
      createdAt
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "user": {
      "name": "Vamsi",
      "email": "vamsi@example.com",
      "posts": [
        {
          "title": "GraphQL Basics",
          "createdAt": "2025-01-15"
        }
      ]
    }
  }
}
```

### Mutations

Modify data on the server:

```graphql
mutation CreateUser {
  createUser(input: {
    name: "Vamsi"
    email: "vamsi@example.com"
    age: 27
  }) {
    id
    name
    email
  }
}
```

### Subscriptions

Real-time updates via WebSocket:

```graphql
subscription OnNewPost {
  postCreated {
    id
    title
    author {
      name
    }
  }
}
```

## Resolvers

Resolvers are functions that fetch data for each field in the schema.

```java
@Component
public class UserResolver implements GraphQLQueryResolver {

    private final UserService userService;

    public User user(String id) {
        return userService.findById(id);
    }

    public List<User> users(int limit, int offset) {
        return userService.findAll(limit, offset);
    }
}
```

## N+1 Problem & DataLoader

The N+1 problem occurs when fetching related data triggers one query per item.

**Without DataLoader**: 1 query for users + N queries for each user's posts.

**With DataLoader**: Batches requests into 2 queries total.

```java
@Component
public class PostDataLoader extends MappedBatchLoader<String, List<Post>> {

    @Override
    public CompletionStage<Map<String, List<Post>>> load(Set<String> userIds) {
        return CompletableFuture.supplyAsync(() ->
            postService.findByUserIds(userIds)
        );
    }
}
```

## Fragments

Reuse field selections:

```graphql
fragment UserFields on User {
  id
  name
  email
}

query {
  user(id: "123") {
    ...UserFields
    posts {
      title
    }
  }
}
```

## Directives

Control query execution:

```graphql
query GetUser($withPosts: Boolean!) {
  user(id: "123") {
    name
    email
    posts @include(if: $withPosts) {
      title
    }
  }
}
```

## Security Best Practices

!!! warning "GraphQL Security"
    GraphQL's flexibility can be exploited. Always implement these safeguards.

- **Query depth limiting** — prevent deeply nested queries
- **Query complexity analysis** — assign costs to fields
- **Rate limiting** — per-client request throttling
- **Persisted queries** — whitelist allowed queries in production
- **Input validation** — validate all mutation inputs
- **Authentication** — use middleware for auth checks
- **Field-level authorization** — check permissions per field

## GraphQL vs REST — When to Use

!!! tip "Choose GraphQL when..."
    - Clients need flexible data fetching (mobile apps, SPAs)
    - You have deeply nested or interconnected data
    - Multiple client types need different data shapes
    - You want a strongly typed API contract

!!! tip "Choose REST when..."
    - Simple CRUD operations dominate
    - Caching at the HTTP level is critical
    - File uploads are a primary use case
    - You need wide ecosystem/tooling support
