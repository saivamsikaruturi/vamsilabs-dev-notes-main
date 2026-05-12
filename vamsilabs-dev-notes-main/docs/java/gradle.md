# Gradle — Modern Build Tool for Java

Gradle is a **flexible, fast build automation tool** used by Android, Spring Boot, and many large-scale Java projects. It uses **Groovy or Kotlin DSL** instead of XML (unlike Maven).

---

## Gradle vs Maven

| Feature | Gradle | Maven |
|---|---|---|
| Config language | Groovy / Kotlin DSL | XML |
| Speed | Faster (incremental builds, build cache) | Slower (always full lifecycle) |
| Flexibility | Highly scriptable | Convention-over-configuration |
| Android | Official build tool | Not supported |
| Learning curve | Steeper | Easier for beginners |
| Dependency mgmt | Same (uses Maven repos) | Same |

**Rule of thumb**: Use Gradle for Android and projects needing custom build logic. Use Maven for straightforward Java/Spring Boot projects.

---

## Project Structure

```
my-project/
├── build.gradle          ← Build configuration (like pom.xml)
├── settings.gradle       ← Multi-module project settings
├── gradle/
│   └── wrapper/
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties
├── gradlew               ← Unix wrapper script
├── gradlew.bat           ← Windows wrapper script
└── src/
    ├── main/
    │   ├── java/         ← Application source code
    │   └── resources/    ← Config files, properties
    └── test/
        ├── java/         ← Test source code
        └── resources/    ← Test config files
```

---

## Anatomy of `build.gradle`

```groovy
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.2.0'
    id 'io.spring.dependency-management' version '1.1.4'
}

group = 'com.example'
version = '1.0.0'

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

repositories {
    mavenCentral()
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    runtimeOnly 'org.postgresql:postgresql'
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
}

tasks.named('test') {
    useJUnitPlatform()
}
```

---

## Dependency Scopes

| Gradle scope | Maven equivalent | When available |
|---|---|---|
| `implementation` | `compile` | Compile + runtime, NOT exposed to consumers |
| `api` | `compile` | Compile + runtime, exposed to consumers |
| `compileOnly` | `provided` | Compile only (e.g., Lombok) |
| `runtimeOnly` | `runtime` | Runtime only (e.g., JDBC drivers) |
| `testImplementation` | `test` | Test compile + runtime |
| `annotationProcessor` | N/A | Annotation processing (e.g., Lombok, MapStruct) |

**Key difference**: `implementation` vs `api`. Use `implementation` by default — it hides the dependency from modules that depend on yours, reducing recompilation.

---

## Essential Commands

```bash
# Build the project
./gradlew build

# Run the application (Spring Boot)
./gradlew bootRun

# Run tests
./gradlew test

# Clean build artifacts
./gradlew clean

# See dependency tree
./gradlew dependencies

# List all tasks
./gradlew tasks

# Build without tests
./gradlew build -x test

# Refresh dependencies
./gradlew build --refresh-dependencies
```

---

## Build Lifecycle

```
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │ Initialization│───►│Configuration│───►│  Execution   │
    └─────────────┘    └─────────────┘    └─────────────┘
         │                    │                    │
    Read settings.gradle  Configure tasks     Run requested tasks
    Determine projects    Resolve deps        (compile, test, etc.)
```

---

## Multi-Module Project

### `settings.gradle`

```groovy
rootProject.name = 'order-system'
include 'order-api', 'order-service', 'common'
```

### Root `build.gradle`

```groovy
subprojects {
    apply plugin: 'java'

    group = 'com.example'
    version = '1.0.0'

    java {
        sourceCompatibility = JavaVersion.VERSION_17
    }

    repositories {
        mavenCentral()
    }

    dependencies {
        testImplementation 'org.junit.jupiter:junit-jupiter:5.10.0'
    }
}
```

### Module `order-service/build.gradle`

```groovy
dependencies {
    implementation project(':common')
    implementation project(':order-api')
    implementation 'org.springframework.boot:spring-boot-starter-web'
}
```

---

## Custom Tasks

```groovy
tasks.register('hello') {
    group = 'custom'
    description = 'Prints a greeting'
    doLast {
        println 'Hello from Gradle!'
    }
}

tasks.register('generateBuildInfo') {
    def outputFile = file("$buildDir/build-info.txt")
    outputs.file(outputFile)
    doLast {
        outputFile.text = "Version: ${project.version}\nBuilt: ${new Date()}"
    }
}
```

---

## Gradle Wrapper

Always use the wrapper (`./gradlew`) instead of a system-installed Gradle. This ensures everyone on the team uses the **same Gradle version**.

```bash
# Generate wrapper (one-time, commit to Git)
gradle wrapper --gradle-version 8.5

# Everyone else just runs
./gradlew build
```

---

## Interview Questions

??? question "1. What is the difference between `implementation` and `api` in Gradle?"
    `implementation` hides the dependency from consumers of your module — if module A depends on module B with `implementation 'lib'`, module A cannot see `lib`. `api` exposes it transitively. Use `implementation` by default for faster builds (fewer recompilations).

??? question "2. How does Gradle achieve faster builds than Maven?"
    Three mechanisms: **Incremental compilation** (only recompiles changed files), **build cache** (reuses outputs from previous builds), and **daemon** (keeps a JVM process running to avoid startup overhead). Gradle can also run tasks in parallel.

??? question "3. How do you handle dependency conflicts in Gradle?"
    Use `./gradlew dependencies` to see the tree. Force a version with `implementation('lib:name') { version { strictly '2.0' } }`. Or use a resolution strategy: `configurations.all { resolutionStrategy { force 'com.google.guava:guava:31.1-jre' } }`.
