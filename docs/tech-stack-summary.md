# TrọƠi Tech Stack

This document defines the technology stack selected for the TrọƠi mobile application and its supporting backend infrastructure.

TrọƠi is developed as an Android-first application with a self-hosted backend. The stack is intentionally kept focused and conventional so that the team can maintain a consistent codebase while using AI coding assistants during development.

---

## Stack Overview

| Area | Technology | Purpose |
| --- | --- | --- |
| Mobile Platform | Android | Primary application platform |
| Mobile Language | Kotlin | Main language for Android development |
| Mobile UI | Jetpack Compose | Declarative Android UI framework |
| Mobile Architecture | MVVM + Repository | Application state and data-flow structure |
| Dependency Injection | Hilt | Dependency management on Android |
| Async / Reactive State | Kotlin Coroutines + Flow | Asynchronous work and reactive state |
| HTTP Client | Retrofit + OkHttp | Communication with the backend API |
| Serialization | kotlinx.serialization | JSON serialization and deserialization |
| Local Database | Room | Structured local persistence and caching |
| Local Preferences | DataStore | Lightweight application preferences |
| Image Loading | Coil | Image loading and caching in Compose |
| Backend | NestJS | Backend application framework |
| Backend Language | TypeScript | Main backend language |
| Backend Architecture | Modular Monolith | Modular backend within a single deployable application |
| Primary Database | PostgreSQL | Persistent relational application data |
| Cache / Temporary State | Redis | Cache and short-lived application state |
| Object Storage | MinIO | Self-hosted S3-compatible file storage |
| API Contract | OpenAPI / Swagger | Contract between the backend and Android application |
| Reverse Proxy | Traefik | HTTPS termination and service routing |
| Containerization | Docker | Containerized backend infrastructure |
| Local / Server Orchestration | Docker Compose | Multi-container environment management |
| CI/CD | GitHub Actions | Automated build, test, and validation workflows |
| UI/UX Design | Figma | UI/UX and design-system source of truth |

---

# Mobile Application

## Kotlin

Kotlin is the primary programming language for the TrọƠi Android application.

It provides strong type safety, null safety, first-class Android support, and interoperability with the Android ecosystem. Using Kotlin also allows the project to work directly with native Android APIs without introducing an additional cross-platform abstraction layer.

---

## Jetpack Compose

Jetpack Compose is the primary UI framework for the Android application.

Compose uses a declarative UI model where the interface is rendered from application state. This makes screens and reusable components easier to structure, test, and keep consistent with the application's design system.

---

## MVVM + Repository

The Android application follows an MVVM-based architecture combined with the Repository pattern.

The main responsibilities are separated as follows:

- **Compose UI** renders application state and forwards user interactions.
- **ViewModel** owns screen state and coordinates application logic.
- **Repository** provides a stable boundary for remote and local data access.
- **Remote and local data sources** communicate with the backend API and local persistence.

The project is organized primarily by product feature rather than by global technical layer.

---

## Hilt

Hilt is used for dependency injection in the Android application.

It manages dependencies such as API clients, repositories, databases, and application services. Centralized dependency injection reduces manual object construction and keeps dependencies consistent across features.

---

## Kotlin Coroutines + Flow

Kotlin Coroutines are used for asynchronous operations such as network requests, database access, and file operations.

Flow is used for reactive streams and state that changes over time. It integrates naturally with ViewModel and Jetpack Compose for state-driven interfaces.

---

## Retrofit + OkHttp

Retrofit is the primary HTTP client used by the Android application to communicate with the TrọƠi backend.

OkHttp provides the underlying HTTP transport and handles concerns such as connections, interceptors, request headers, authentication, and network logging.

The API models and endpoints must remain consistent with the backend OpenAPI contract.

---

## kotlinx.serialization

`kotlinx.serialization` is used for serialization between JSON payloads and Kotlin models.

It provides type-safe serialization that integrates directly with Kotlin and avoids maintaining a separate JSON mapping approach.

---

## Room

Room provides structured local persistence on Android using SQLite.

It is intended for local application data and caching where persistent structured storage is useful. PostgreSQL remains the authoritative server-side data source.

---

## DataStore

DataStore is used for lightweight local application preferences and configuration.

Typical examples include UI preferences, language settings, onboarding state, and other small pieces of non-relational local state.

Sensitive credentials must not be stored as plain text in DataStore.

---

## Coil

Coil is used for loading and caching images in the Android application.

It integrates directly with Kotlin and Jetpack Compose and will be used for content such as room images, incident attachments, and user-facing media.

---

# Backend

## NestJS

NestJS is the primary backend framework for TrọƠi.

It provides a structured TypeScript architecture built around modules, controllers, services, dependency injection, validation, and standardized HTTP APIs.

Its convention-based structure helps keep backend implementation consistent across different product domains.

---

## TypeScript

TypeScript is the primary language used by the backend.

Static typing improves maintainability of domain models, DTOs, services, and API contracts while reducing errors caused by inconsistent object structures.

---

## Modular Monolith

The backend is implemented as a modular monolith.

Business domains are separated into independent modules while remaining part of one deployable backend application.

Initial modules are expected to include domains such as:

- Authentication
- Properties
- Rooms
- Tenancies
- Billing
- Receipts
- Incidents
- Notifications
- Audit history

This structure provides clear domain boundaries without introducing distributed-system complexity.

---

# Data and Storage

## PostgreSQL

PostgreSQL is the primary relational database and authoritative data store for TrọƠi.

It stores persistent application data such as users, properties, rooms, tenancies, charges, payment records, receipts, incidents, permissions, and operational history.

The relational model and transactional capabilities of PostgreSQL are well suited to the strongly related operational data managed by TrọƠi.

---

## Redis

Redis is used for data that is temporary or benefits from fast in-memory access.

Potential responsibilities include:

- caching;
- rate limiting;
- OTP state;
- temporary session data;
- short-lived application state.

Redis is not the authoritative store for business data.

---

## MinIO

MinIO provides self-hosted object storage using an S3-compatible API.

It stores binary objects such as:

- room images;
- incident photos;
- receipt attachments;
- avatars;
- uploaded documents.

PostgreSQL stores the metadata and object references, while the binary files themselves are stored in MinIO.

Using an S3-compatible interface also keeps the storage layer portable if the project later moves to another compatible object-storage provider.

---

# API

## OpenAPI / Swagger

OpenAPI defines the contract between the NestJS backend and the Android application.

The API specification describes:

- endpoints;
- request models;
- response models;
- validation requirements;
- status codes;
- error structures.

Swagger tooling is used on the backend to generate and expose the OpenAPI specification.

The OpenAPI contract acts as the shared source of truth between mobile and backend implementations.

---

# Infrastructure

## Docker

Docker is used to package backend services and infrastructure dependencies into reproducible containers.

This ensures that development and deployment environments use consistent versions and configurations.

---

## Docker Compose

Docker Compose manages the TrọƠi backend environment during development and initial self-hosted deployment.

The environment can include:

- NestJS API;
- PostgreSQL;
- Redis;
- MinIO;
- Traefik.

The goal is to make the backend environment reproducible with a small number of commands rather than requiring developers to configure every dependency manually.

---

## Traefik

Traefik acts as the reverse proxy for the self-hosted backend infrastructure.

Its responsibilities include:

- routing external requests to backend services;
- HTTPS/TLS termination;
- domain and subdomain routing;
- integration with Docker services.

Application services remain behind Traefik instead of being exposed directly to the internet.

---

# Development Tooling

## GitHub Actions

GitHub Actions provides CI/CD automation for the project.

Automated workflows will be used to validate changes through tasks such as:

- Android builds;
- backend builds;
- automated tests;
- static analysis;
- API contract validation.

The exact workflows will evolve with the codebase, but GitHub Actions remains the selected automation platform.

---

## Figma

Figma is the source of truth for the TrọƠi UI/UX design system.

It defines visual foundations and reusable interface components before they are implemented in Jetpack Compose.

Design definitions include areas such as:

- color;
- typography;
- spacing;
- component states;
- reusable components;
- application screens.

The Android implementation should follow the shared Figma design system rather than defining independent visual styles for individual screens.
