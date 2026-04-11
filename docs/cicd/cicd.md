# CI/CD Pipelines

## What is CI/CD?

| Term | Definition |
|---|---|
| **Continuous Integration (CI)** | Developers frequently merge code changes into a shared repository, with automated builds and tests running on every commit. |
| **Continuous Delivery (CD)** | Automatically prepares code changes for release to production. Every commit that passes tests is a release candidate. |
| **Continuous Deployment** | Goes one step further — every change that passes the automated pipeline is deployed to production automatically. |

```
Code Commit → Build → Unit Tests → Integration Tests → Security Scan → Staging → Production
     CI ──────────────────────────────────┤
     CD ──────────────────────────────────────────────────────────────────────────┤
```

## CI/CD Tools Comparison

| Tool | Type | Best For |
|---|---|---|
| **Jenkins** | Self-hosted | Maximum flexibility, plugin ecosystem |
| **GitHub Actions** | Cloud-native | GitHub-integrated workflows |
| **GitLab CI** | Integrated | Full DevOps platform |
| **CircleCI** | Cloud/Self-hosted | Docker-native pipelines |
| **ArgoCD** | GitOps | Kubernetes deployments |
| **Tekton** | Cloud-native | Kubernetes-native CI/CD |

## GitHub Actions

### Basic Workflow

```yaml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: maven

      - name: Build with Maven
        run: mvn clean verify

      - name: Run Tests
        run: mvn test

      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: target/surefire-reports/

  docker:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: myapp:latest
```

### Matrix Builds

Test across multiple versions simultaneously:

```yaml
jobs:
  test:
    strategy:
      matrix:
        java-version: [17, 21]
        os: [ubuntu-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/setup-java@v4
        with:
          java-version: ${{ matrix.java-version }}
```

## Jenkins Pipeline

### Declarative Pipeline (Jenkinsfile)

```groovy
pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "myapp:${env.BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build') {
            steps {
                sh 'mvn clean compile'
            }
        }

        stage('Test') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        sh 'mvn test'
                    }
                }
                stage('Integration Tests') {
                    steps {
                        sh 'mvn verify -Pintegration'
                    }
                }
            }
        }

        stage('Security Scan') {
            steps {
                sh 'mvn dependency-check:check'
            }
        }

        stage('Docker Build') {
            steps {
                sh "docker build -t ${DOCKER_IMAGE} ."
            }
        }

        stage('Deploy to Staging') {
            when {
                branch 'develop'
            }
            steps {
                sh 'kubectl apply -f k8s/staging/'
            }
        }

        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            input {
                message "Deploy to production?"
                ok "Deploy"
            }
            steps {
                sh 'kubectl apply -f k8s/production/'
            }
        }
    }

    post {
        always {
            junit 'target/surefire-reports/*.xml'
        }
        failure {
            mail to: 'team@example.com',
                 subject: "Pipeline Failed: ${env.JOB_NAME}",
                 body: "Check: ${env.BUILD_URL}"
        }
    }
}
```

## Deployment Strategies

### Blue-Green Deployment

```
                    ┌─────────────┐
   Traffic ────────►│  Blue (v1)  │  ← Currently live
                    └─────────────┘
                    ┌─────────────┐
                    │ Green (v2)  │  ← New version (idle)
                    └─────────────┘

   After verification, switch traffic:

                    ┌─────────────┐
                    │  Blue (v1)  │  ← Now idle
                    └─────────────┘
                    ┌─────────────┐
   Traffic ────────►│ Green (v2)  │  ← Now live
                    └─────────────┘
```

**Pros**: Zero downtime, instant rollback.
**Cons**: Requires double the infrastructure.

### Canary Deployment

Gradually shift traffic from old to new version:

```
Phase 1:  v1 ████████████████████ 95%    v2 █ 5%
Phase 2:  v1 ████████████████ 75%        v2 █████ 25%
Phase 3:  v1 ██████████ 50%              v2 ██████████ 50%
Phase 4:  v1 █ 5%                        v2 ████████████████████ 95%
Phase 5:                                 v2 █████████████████████ 100%
```

### Rolling Update

Replace instances one-by-one:

```
Step 1: [v1] [v1] [v1] [v1]
Step 2: [v2] [v1] [v1] [v1]
Step 3: [v2] [v2] [v1] [v1]
Step 4: [v2] [v2] [v2] [v1]
Step 5: [v2] [v2] [v2] [v2]
```

## Pipeline Best Practices

!!! tip "Pipeline Design"
    - **Fail fast** — run quick checks (lint, compile) before slow ones (integration tests)
    - **Parallelize** — run independent stages concurrently
    - **Cache dependencies** — avoid re-downloading on every run
    - **Use immutable artifacts** — build once, deploy the same artifact everywhere
    - **Infrastructure as Code** — version control all pipeline definitions
    - **Secret management** — never hardcode credentials; use vault/secrets managers
    - **Automated rollback** — detect failures and revert automatically
    - **Observability** — monitor pipeline metrics (duration, failure rate, recovery time)
