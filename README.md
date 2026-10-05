# StreamX — Real-Time Live Streaming & Video Conferencing Platform

StreamX is a scalable, cloud-native microservices platform for real-time video conferencing, live streaming, and interactive web collaboration. Built with **Next.js**, **Express**, **Socket.io / WebRTC**, **PostgreSQL**, **Redis**, and **Redpanda (Kafka)**, and containerized for deployment on **Kubernetes (EKS)**.

---

## 🏗️ System Architecture & Architecture Diagram

```mermaid
flowchart TD
    subgraph Client ["Client Layer"]
        Frontend["Frontend Web (Next.js - Port 3000)"]
    end

    subgraph Ingress ["Kubernetes Ingress"]
        NginxIngress["NGINX Ingress Controller / ALB"]
    end

    subgraph Gateway ["API & Routing"]
        APIGateway["API Gateway (Port 4000)"]
    end

    subgraph Services ["Microservices Layer"]
        AuthService["Auth Service (Port 4001)"]
        MeetingService["Meeting Service (Port 4002)"]
        SignalingService["Signaling Service - WebSockets (Port 4003)"]
    end

    subgraph Stateful ["Stateful & Infrastructure Layer (StatefulSets)"]
        Postgres[(PostgreSQL 15 - DB: streamx)]
        Redis[(Redis 7 - Pub/Sub Adapter)]
        Redpanda[(Redpanda - Kafka Event Broker)]
    end

    %% Routing Flow
    Frontend -->|HTTP / WebSockets| NginxIngress
    NginxIngress -->|/| Frontend
    NginxIngress -->|/api| APIGateway
    NginxIngress -->|/socket.io| SignalingService

    %% API Gateway Proxies
    APIGateway -->|/api/auth| AuthService
    APIGateway -->|/api/meetings| MeetingService
    APIGateway -->|/socket.io| SignalingService

    %% Service Connections
    AuthService -->|User Auth & JWT| Postgres
    MeetingService -->|Meeting Schema| Postgres
    SignalingService -->|WebSockets State / Adapter| Redis
```

---

## 🧩 Microservices Breakdown & Service Interconnections

### 1. **API Gateway (`api-gateway`)**
* **Port**: `4000`
* **Docker Image**: `585768182430.dkr.ecr.us-east-1.amazonaws.com/streamx-api-gateway:latest`
* **Role & Functionality**: Single entrypoint for all client HTTP and WebSocket requests. Handles CORS, request logging, and reverse proxying to downstream backend microservices.
* **Connections**:
  * Proxies `/api/auth` $\rightarrow$ `auth-service:4001`
  * Proxies `/api/meetings` $\rightarrow$ `meeting-service:4002`
  * Proxies `/socket.io` $\rightarrow$ `signaling-service:4003`

### 2. **Authentication Service (`auth-service`)**
* **Port**: `4001`
* **Docker Image**: `585768182430.dkr.ecr.us-east-1.amazonaws.com/streamx-auth-service:latest`
* **Role & Functionality**: Manages user identity, registration, password hashing (bcrypt), and JWT token issuance/verification.
* **Connections**:
  * Connects to **PostgreSQL** (`postgresql://atul:Atul9690%40m3@postgres-service:5432/streamx?schema=public`) via Prisma ORM for persistent user record storage.

### 3. **Meeting Service (`meeting-service`)**
* **Port**: `4002`
* **Docker Image**: `585768182430.dkr.ecr.us-east-1.amazonaws.com/streamx-meeting-service:latest`
* **Role & Functionality**: Handles room creation, meeting scheduling, access control, and meeting metadata management.
* **Connections**:
  * Connects to **PostgreSQL** (`postgresql://atul:Atul9690%40m3@postgres-service:5432/streamx?schema=meetings`) via Prisma ORM for meeting data storage.

### 4. **Signaling Service (`signaling-service`)**
* **Port**: `4003`
* **Docker Image**: `585768182430.dkr.ecr.us-east-1.amazonaws.com/streamx-signaling-service:latest`
* **Role & Functionality**: Real-time WebSockets server built with **Socket.io**. Performs WebRTC peer-to-peer connection exchange (SDP Offers, SDP Answers, ICE Candidates) and real-time room chat message broadcasting.
* **Connections**:
  * Connects to **Redis** (`redis://redis-service:6379`) using `@socket.io/redis-adapter` for multi-instance socket state synchronization and cross-pod message broadcasting.

### 5. **Frontend Web (`frontend-web`)**
* **Port**: `3000`
* **Docker Image**: `585768182430.dkr.ecr.us-east-1.amazonaws.com/streamx-frontend-web:latest`
* **Role & Functionality**: Modern Next.js user interface providing user authentication screens, meeting dashboard, room creation modal, and interactive video streaming workspace.

### 6. **Infrastructure Dependencies (StatefulSets)**
* 🐘 **PostgreSQL 15**: Primary relational database containing `public` schema (auth) and `meetings` schema (meeting metadata).
* 🔴 **Redis 7**: In-memory cache and socket Pub/Sub broker for horizontal scaling of signaling services.
* 🐼 **Redpanda (Kafka-compatible)**: High-throughput event streaming platform for asynchronous events (recording status, transcription jobs, notifications).

---

## 📊 Summary of Completed vs. Future Services

| Service Name | Status | Type | Purpose |
| :--- | :--- | :--- | :--- |
| **api-gateway** | 🟢 Completed | Microservice | Single entrypoint HTTP/WebSocket reverse proxy |
| **auth-service** | 🟢 Completed | Microservice | User authentication, registration, JWT validation |
| **meeting-service** | 🟢 Completed | Microservice | Meeting creation, room tokens, scheduled rooms |
| **signaling-service** | 🟢 Completed | Microservice | WebSockets WebRTC signaling & real-time room chat |
| **frontend-web** | 🟢 Completed | Next.js Frontend | Web application user interface |
| **postgres** | 🟢 Completed | StatefulSet | Relational storage for users & meeting records |
| **redis** | 🟢 Completed | StatefulSet | Socket.io adapter & caching layer |
| **redpanda** | 🟢 Completed | StatefulSet | Event messaging broker for async workloads |
| **chat-service** | ⏳ Planned | Microservice | Persistent chat history & file attachments |
| **notification-service** | ⏳ Planned | Microservice | Email, SMS, and in-app notifications |
| **recording-orchestrator** | ⏳ Planned | Microservice | Cloud stream recording & storage worker |
| **transcription-ai** | ⏳ Planned | Microservice | Live AI speech-to-text transcript generation |
| **user-service** | ⏳ Planned | Microservice | Advanced user profiles & team RBAC permissions |

---

## 📂 Kubernetes Folder Structure (`k8s/`)

```text
k8s/
├── namespace.yaml                # Namespace 'live-stream'
├── kustomization.yaml            # Master Kustomize bundle
├── ingress.yaml                  # NGINX Ingress rules
├── deploy.sh                     # Automated deployment script
├── postgres/                     # PostgreSQL 15 StatefulSet & PV/PVC/Service
│   ├── pv.yaml
│   ├── pvc.yaml
│   ├── statefulset.yaml
│   └── service.yaml
├── redis/                        # Redis 7 StatefulSet & PV/PVC/Service
│   ├── pv.yaml
│   ├── pvc.yaml
│   ├── statefulset.yaml
│   └── service.yaml
├── redpanda/                     # Redpanda Kafka StatefulSet & PV/PVC/Service
│   ├── pv.yaml
│   ├── pvc.yaml
│   ├── statefulset.yaml
│   └── service.yaml
├── auth-service/                 # Auth Service Deployment & ConfigMap
│   ├── configmap.yaml
│   ├── deployment.yaml
│   └── service.yaml
├── meeting-service/              # Meeting Service Deployment & ConfigMap
│   ├── configmap.yaml
│   ├── deployment.yaml
│   └── service.yaml
├── signaling-service/            # Signaling Service Deployment & ConfigMap
│   ├── configmap.yaml
│   ├── deployment.yaml
│   └── service.yaml
├── api-gateway/                  # API Gateway Deployment & ConfigMap
│   ├── configmap.yaml
│   ├── deployment.yaml
│   └── service.yaml
└── frontend-web/                 # Next.js Frontend Deployment
    ├── deployment.yaml
    └── service.yaml
```

---

## 🚀 Quick Deployment Guide

### Deploying to Kubernetes Cluster

```bash
# 1. Apply all manifests using Kustomize
kubectl apply -k k8s/

# 2. Check cluster status in 'live-stream' namespace
kubectl get pods,svc -n live-stream
```

### AWS ECR Integration

Images are hosted on Amazon ECR in `us-east-1` under account `585768182430`. Kubernetes worker nodes pull images natively using their AWS IAM Role (`AmazonEKSNodeRole` with `AmazonEC2ContainerRegistryReadOnly` policy).

```bash
# Build & Push API Gateway Image
docker build -t 585768182430.dkr.ecr.us-east-1.amazonaws.com/streamx-api-gateway:latest ./api-gateway
docker push 585768182430.dkr.ecr.us-east-1.amazonaws.com/streamx-api-gateway:latest
```
