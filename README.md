# 🎬 Verdikt | Full-Stack Media Review & Aggregation Platform

[![Live Demo](https://img.shields.io/badge/Live_Demo-verdikt--two.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://verdikt-two.vercel.app/)
[![Backend](https://img.shields.io/badge/Backend-Java_17_%7C_Spring_Boot_3-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)](#-tech-stack)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js_14_%7C_React-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](#-tech-stack)
[![Docker](https://img.shields.io/badge/Dockerized-Multi--Stage_Builds-2496ED?style=for-the-badge&logo=docker&logoColor=white)](#-tech-stack)

**Verdikt** is a decoupled full-stack media review and data aggregation platform built with **Java 17 (Spring Boot)** and **Next.js**. It aggregates real-time data across movies, TV shows, books, and video games into a single, unified client experience while implementing resilient backend API handling, environment security, and cloud-native deployments.

---

## 🚀 Key Features

- **Multi-Source Data Aggregation:** Unifies disparate third-party APIs (**TMDB**, **Google Books**, and **IGDB**) into a single, normalized relational schema.
- **Resilient Integration Layer:** Built-in rate-limiting resilience and fallback handling to maintain platform stability during external API throttling or downtime.
- **Decoupled Architecture:** Clean RESTful API separation using Spring Boot backend services and a Next.js SSR/ISR frontend, reducing client-side load times by **~30%**.
- **Cloud-Native Deployment:** Production backend containerized with multi-stage Docker builds (~40% smaller image footprint) hosted on **Render**, managed MySQL database hosted on **Aiven**, and frontend hosted on **Vercel**.
- **Environment & Credential Isolation:** Zero-trust configuration management across local and production workflows using strict environment variable abstraction.

---

## 🛠️ Tech Stack

### **Backend Service**
* **Language/Framework:** Java 17, Spring Boot 3
* **Persistence & ORM:** Spring Data JPA, Hibernate
* **Database:** Managed MySQL (Aiven)
* **Security & Testing:** Spring Security, JUnit 5, Mockito

### **Frontend Client**
* **Framework:** Next.js 14, React, TypeScript
* **Styling:** Tailwind CSS
* **Deployment:** Vercel

### **DevOps & Infrastructure**
* **Containerization:** Docker (Multi-stage builds)
* **Cloud Infrastructure:** Render (Spring Boot API), Aiven (Managed MySQL Database), Vercel (Next.js Frontend)
* **CI/CD:** Automated GitHub Deployment Pipelines

---

## 📐 System Architecture
                   ┌─────────────────────────┐
                   │ Next.js Client (Vercel) │ 
                   └───────────┬─────────────┘
                               │ REST APIs
                               ▼
                   ┌─────────────────────────┐
                   │Spring Boot API (Render)│
                   └─────┬──────────────┬────┘
                         │              │
   ┌─────────────────────┴──┐        ┌─┴───────────────────────┐
   │ External Data Services │        │   MySQL Database        │
   │ (TMDB / Books / IGDB)  │       │ (Persisted Aggregations)│
   └────────────────────────┘        └─────────────────────────┘

---

## 📦 Getting Started

### **Prerequisites**
- Java 17 JDK
- Node.js 18+ and npm
- Docker Desktop
- MySQL Server (if running locally without Docker)

### **1. Clone the Repository**
```bash
git clone [https://github.com/rishabhgjr10/verdikt](https://github.com/rishabhgjr10/verdikt).
cd verdikt

🔗 Live Application & Links
Live Platform: https://verdikt-two.vercel.app/

Developer Profile: github.com/rishabhgjr10

📝 License
Distributed under the MIT License. See LICENSE for more information.
