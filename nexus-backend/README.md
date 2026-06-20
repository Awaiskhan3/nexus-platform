# Nexus Platform – Full Stack Implementation

> Investor & Entrepreneur Collaboration Platform  
> Built on top of the original frontend with a complete Node.js + Express + MongoDB backend.

---

## 📁 Project Structure

```
nexus/
├── nexus-frontend/          # React + TypeScript + Vite (original + extended)
│   ├── src/
│   │   ├── services/        # ← NEW: API + Socket.io service layers
│   │   │   ├── api.ts       # Axios client with all API calls + token refresh
│   │   │   └── socket.ts    # Socket.io client for real-time features
│   │   ├── context/
│   │   │   └── AuthContext.tsx   # ← UPDATED: now calls real backend
│   │   └── pages/
│   │       └── meetings/    # ← NEW: full meeting scheduling UI
│   └── .env.example
│
└── nexus-backend/           # ← NEW: Express + MongoDB API
    └── src/
        ├── config/
        │   └── database.js       # MongoDB connection
        ├── models/
        │   ├── User.js           # Extended user schema (entrepreneur + investor)
        │   ├── Meeting.js        # Meetings with conflict detection
        │   ├── Message.js        # Chat messages
        │   ├── CollaborationRequest.js
        │   ├── Document.js       # File metadata
        │   └── Notification.js   # Real-time notifications
        ├── controllers/          # Business logic
        │   ├── authController.js
        │   ├── userController.js
        │   ├── meetingController.js
        │   ├── collaborationController.js
        │   ├── messageController.js
        │   ├── documentController.js
        │   └── notificationController.js
        ├── routes/               # Express routers
        ├── middleware/
        │   ├── auth.js           # JWT protect + role restrict
        │   ├── errorHandler.js   # Global error handler
        │   └── upload.js         # Multer + Cloudinary
        ├── utils/
        │   ├── jwt.js            # Token helpers
        │   ├── email.js          # Nodemailer templates
        │   └── response.js       # Standardized responses
        └── server.js             # Express + Socket.io entry point
```

---

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd nexus-backend
npm install
cp .env.example .env
# Fill in your MongoDB URI, JWT secrets, email credentials, Cloudinary keys
npm run dev         # Starts on http://localhost:5000
```

### 2. Frontend Setup

```bash
cd nexus-frontend
npm install
cp .env.example .env
# VITE_API_URL=http://localhost:5000/api
# VITE_SOCKET_URL=http://localhost:5000
npm run dev         # Starts on http://localhost:5173
```

---

## 🌐 API Reference

Base URL: `http://localhost:5000/api`

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login + get tokens |
| POST | `/auth/logout` | Logout (clears refresh token) |
| POST | `/auth/refresh-token` | Get new access token |
| GET | `/auth/me` | Get current user |
| POST | `/auth/forgot-password` | Send reset email |
| POST | `/auth/reset-password` | Reset with token |
| PUT | `/auth/change-password` | Change password (auth required) |

### Users / Profiles
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/profile/:id` | Get any user's profile |
| PUT | `/users/profile` | Update own profile |
| POST | `/users/avatar` | Upload avatar (multipart) |
| GET | `/users/entrepreneurs` | List entrepreneurs (filter: industry, location, search) |
| GET | `/users/investors` | List investors (filter: interests, stage, search) |
| DELETE | `/users/account` | Deactivate own account |

### Meetings
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/meetings` | Schedule meeting (conflict detection built-in) |
| GET | `/meetings` | Get user's meetings (filter: status, upcoming) |
| GET | `/meetings/:id` | Get single meeting |
| PUT | `/meetings/:id` | Update meeting details |
| PATCH | `/meetings/:id/respond` | Accept or reject (attendee only) |
| PATCH | `/meetings/:id/cancel` | Cancel meeting (organizer only) |

### Collaborations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/collaborations` | Send request (investor → entrepreneur) |
| GET | `/collaborations` | Get sent/received requests |
| PATCH | `/collaborations/:id/respond` | Accept or reject (entrepreneur) |
| DELETE | `/collaborations/:id` | Withdraw pending request |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/messages/conversations` | List all conversations with last message |
| GET | `/messages/:userId` | Get message thread |
| POST | `/messages/:userId` | Send message |
| DELETE | `/messages/:messageId` | Soft-delete message |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/documents/upload` | Upload document (multipart) |
| GET | `/documents` | Get owned + shared documents |
| GET | `/documents/:id` | Get single document |
| POST | `/documents/:id/share` | Share with another user |
| PATCH | `/documents/:id/download` | Track download + get URL |
| DELETE | `/documents/:id` | Delete document |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | Get notifications |
| PATCH | `/notifications/read-all` | Mark all as read |
| PATCH | `/notifications/:id/read` | Mark one as read |
| DELETE | `/notifications/:id` | Delete notification |

---

## 🔌 Real-time Events (Socket.io)

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `typing_start` | `{ receiverId }` | User started typing |
| `typing_stop` | `{ receiverId }` | User stopped typing |
| `join_meeting` | `{ meetingId }` | Join meeting room |
| `leave_meeting` | `{ meetingId }` | Leave meeting room |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `new_message` | Message object | New chat message received |
| `messages_read` | `{ conversationId, readBy }` | Messages marked as read |
| `typing_start` | `{ senderId }` | Other user is typing |
| `typing_stop` | `{ senderId }` | Other user stopped typing |
| `notification` | Notification object | Any notification (meeting, collab, etc.) |
| `user_online` | `{ userId }` | User came online |
| `user_offline` | `{ userId }` | User went offline |
| `user_joined_meeting` | `{ userId }` | User joined meeting room |

---

## 🔐 Security

- **JWT access tokens** (7d) + **refresh tokens** (30d) with automatic rotation
- **Password hashing** with bcrypt (salt rounds: 12)
- **Rate limiting**: 100 req/15min globally, 20 req/15min on auth routes
- **Helmet** for HTTP security headers
- **CORS** restricted to frontend origin
- **Role-based access control** on all sensitive routes
- **Soft deletes** for users (isActive flag)
- **Input validation** via express-validator on all auth routes

---

## 🗄️ Database Models

### User
Extended schema covering both roles. Role-specific fields (e.g. `startupName`, `investmentInterests`) are stored on the same document for simplicity.

### Meeting
- `checkConflict()` static method prevents double-booking for both organizer and attendee
- Auto-generates Jitsi video call link for video meetings
- Supports `pending → accepted/rejected → completed/cancelled` lifecycle

### Message
- `getConversationId()` generates consistent IDs from two user IDs (sorted, joined with `_`)
- Soft delete keeps conversation thread intact

### Document
- Cloudinary integration for file storage
- Per-user sharing with `view`/`download` permissions
- Download counter tracking

---

## 🚢 Deployment

### Backend → Render
1. Create a new **Web Service** on [render.com](https://render.com)
2. Set **Build Command**: `npm install`
3. Set **Start Command**: `node src/server.js`
4. Add all environment variables from `.env.example`
5. Add a MongoDB Atlas connection string

### Frontend → Vercel
1. Import the `nexus-frontend` folder
2. Set environment variables:
   - `VITE_API_URL=https://your-render-backend.onrender.com/api`
   - `VITE_SOCKET_URL=https://your-render-backend.onrender.com`
3. Deploy

---

## 📆 Weekly Progress

### ✅ Week 1 – Completed
- [x] Backend project setup (Express + MongoDB + Socket.io)
- [x] All Mongoose models with validation and indexes
- [x] JWT authentication (register, login, refresh, logout)
- [x] Password reset flow with email
- [x] Role-based access control (investor vs entrepreneur)
- [x] Full profile management API
- [x] Avatar upload via Cloudinary
- [x] Entrepreneur/Investor listing with search & pagination
- [x] Frontend API service layer (`src/services/api.ts`)
- [x] Socket.io client (`src/services/socket.ts`)
- [x] AuthContext wired to real backend
- [x] Automatic token refresh in Axios interceptor

### ✅ Week 2 – Completed (Milestone 3)
- [x] Meeting scheduling API with **conflict detection**
- [x] Accept/reject/cancel meeting endpoints
- [x] Meeting notifications (in-app + email)
- [x] `MeetingsPage.tsx` – full UI: schedule modal, respond buttons, join link
- [x] Meetings added to Sidebar for both roles
- [x] Collaboration request system (send/respond/withdraw)
- [x] Real-time notifications via Socket.io
- [x] Document upload/share/download API
- [x] Message API with conversation aggregation

### 🔜 Week 3 – Upcoming
- [ ] Video calling integration (Daily.co / Agora)
- [ ] Document Processing Chamber (AI-powered analysis)
- [ ] Payment section (Stripe integration)
- [ ] Admin dashboard
- [ ] Full test suite
