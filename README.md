# Cashual Call (Backend) ⚙️🔌

> The scalable real-time matchmaking engine and signaling gateway for Cashual Call.

[![NestJS](https://img.shields.io/badge/NestJS-11.0-red?style=flat-square&logo=nestjs)](https://nestjs.com)
[![Mongoose](https://img.shields.io/badge/Mongoose-8.13-green?style=flat-square&logo=mongodb)](https://mongoosejs.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?style=flat-square&logo=socket.io)](https://socket.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Swagger](https://img.shields.io/badge/Swagger-OpenAPI-85EA2D?style=flat-square&logo=swagger)](https://swagger.io)

---

## 🌟 Key Features

*   **⚡ WebSocket Matchmaking Engine**: Places waiting users into a matchmaking pool and pairs them based on platform type (`chat` vs `voice-call`), verifying block relationships.
*   **🎙️ WebRTC Signaling Gateways**: Broadcasts connection offers, SDP descriptions, and ICE candidates between matched calls.
*   **💬 Persistent Chat Handling**: Stores and processes real-time text chats with built-in delivery statuses, seen flags, and read time logging.
*   **🛡️ Multi-Tier User Protection**: Provides robust mechanisms for checking block statuses and handling user reporting.
*   **🔒 Secure Identity & Access**: Fully custom user registration and authentication endpoints using `bcrypt` and JWT keys.

---

## 🏗️ Technical Highlights & Architecture

The backend is built as a progressive **NestJS** application leveraging structured dependency injection:

*   **Matchmaking Aggregation Pipeline**: Employs a complex MongoDB aggregation query to match candidates. The pipeline queries the `blockedusers` collection, filters out candidates that block the requester or are blocked by them, and selects a random candidate (`$sample: { size: 1 }`).
*   **WebSocket Event Broker**: Uses modular socket gateways (`ChatGateway`, `BlockedUserGateway`, `ReportUserGateway`) that bind decorators directly to socket instances.
*   **Auto-Documentation**: Auto-generates comprehensive OpenAPI documentation using `@nestjs/swagger`, accessible at `/api-docs`.

---

## ⚙️ Local Setup Instructions

### Prerequisites
*   Node.js (v18.x or later)
*   npm (v10.x or later)
*   MongoDB Instance (local server or Atlas cluster)

### Step-by-Step Installation
1.  **Clone the repository** and navigate to the project directory:
    ```bash
    cd chatcall-backend
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Configure environment variables**:
    Create a `.env` file in the root of the project (copying from `.env.example`):
    ```bash
    cp .env.example .env
    ```
4.  **Run the development server**:
    ```bash
    npm run start:dev
    ```
5.  Access the API documentation at [http://localhost:3001/api-docs](http://localhost:3001/api-docs).

---

## 🔌 Environment Variables

```env
# Port number the server will listen on
PORT=3001

# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/chat-app

# JWT Sign/Verification secret key
JWT_SECRET=your-secret-key

# Client CORS URL
CORS_ORIGIN=http://localhost:3000
```
