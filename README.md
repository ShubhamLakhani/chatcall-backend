# PulseRoom

> Next-Generation Real-Time Anonymous Video, Voice & Text Matchmaking Platform.

PulseRoom is a premium, real-time anonymous matchmaking application that enables seamless connection via text chat, voice calls, and video streams. 

---

## ⚡ Key Features

- **💬/🎙️/📹 Multi-Mode Matchmaking**: Start instant anonymous text chats, voice calls (with active audio visualizers), or high-definition video calls with picture-in-picture stream preview panels.
- **⚡ Sub-10ms Matchmaking Queue**: Powered by Redis Sorted Sets (`zadd`, `zpopmin`, Lua script evaluations) and Socket.IO cluster adapter state sharing across nodes.
- **⏭️ Fast Skipping & Keybindings**: Spacebar or Right Arrow keyboard keypresses (and mobile touch swiping) trigger instant leave-room and find-match actions without leaving views.
- **🧊 Interactive Icebreakers**: A curated dataset of 30+ conversation starter prompts synced across peer matches with real-time "Shuffle 🎲" buttons.
- **🛡️ Anti-Abuse Moderation**: Sliding-window rate limiters (5 attempts / 10s), shadowbanning queues (`queue:<moduleType>:shadowban`), and sliding-puzzle CAPTCHAs.
- **🪙 Rewards & Friends**: Daily streaks (🔥), coin rewards (🪙) for calls exceeding 60s, and standard in-call friend requests.
- **💬 In-Call Chat Overlay**: Slide-in glassmorphic chat drawers for texting directly during active voice/video calls.
- **🔑 Google OAuth 2.0 & JWT**: Stateless token credentials supporting email logins and free Google OAuth SSO.
- **🎨 Dark Glassmorphism Design**: Custom slate layout interfaces with Tailwind CSS, backdrop filters, and radial glow accents.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Client** | Next.js 15, React, Redux Toolkit, WebRTC API, Tailwind CSS, Lucide icons |
| **Backend API** | NestJS, Socket.IO, MongoDB (Mongoose), Redis (IORedis), JWT Auth |
| **Infrastructure** | Socket.IO Redis adapter, WebRTC ICE/STUN/TURN configurations |

---

## 📁 Repository Architecture Overview

### Backend Architecture (`chatcall-backend`)
```
src/
├── common/
│   ├── constants/        # Icebreaker questions, metadata
│   ├── filters/          # Exception mapping filters
│   └── redis/            # Redis client & matchmaking queues
├── enums/                # Chat, ModuleType schemas
├── schemas/              # MongoDB model schemas (User, Message, Blocked)
├── web/
│   ├── auth/             # REST Auth & Google OAuth callback controllers
│   ├── chat/             # Socket.IO Gateway & ChatRoom logic
│   └── webrtc/           # ICE/TURN credentials endpoints
└── main.ts               # Server entry point & RedisIoAdapter initialization
```

### Frontend Architecture (`chatcall-frontend`)
```
src/
├── app/                  # App Router views (Home, Call, Chat)
├── components/
│   ├── auth/             # Dark glass LoginForm & SignupForm
│   ├── call/             # Call timers, visualizers, PiP videoframes, side chat drawer
│   └── common/           # Glass headers, Live online counters, Auth modals
├── context/              # Socket connections & query sync contexts
├── hooks/                # useWebRTC, fingerprinting, typing indicators, swiping listeners
├── libs/                 # Axios clients, validations, socket helpers
└── store/                # Redux Toolkit slice states
```

---

## 🚀 Local Setup Guide

### 1. Backend Setup
1. Enter the backend folder:
   ```bash
   cd chatcall-backend
   ```
2. Copy configuration environment variables:
   ```bash
   cp .env.example .env
   ```
3. Update `.env` credentials (MongoDB connections, Redis host, Google OAuth Client IDs).
4. Launch development gateway:
   ```bash
   npm install
   npm run start:dev
   ```

### 2. Frontend Setup
1. Enter the frontend folder:
   ```bash
   cd chatcall-frontend
   ```
2. Launch dev client:
   ```bash
   npm install
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in multiple browser tabs to test matchmaking!
