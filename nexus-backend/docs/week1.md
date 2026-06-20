# Week 1 Documentation – Nexus Platform Backend

**Duration:** Week 1 of 3  
**Focus:** Environment Setup, Core Backend, Authentication, Profiles

---

## Milestone 1: Environment Setup & Codebase Familiarization

### What Was Done

**Codebase Analysis:**
- Reviewed all 40+ existing frontend files
- Identified all components using mock/static data that need real APIs:
  - `AuthContext.tsx` – mock login/register using hardcoded `users.ts`
  - `EntrepreneurDashboard.tsx` / `InvestorDashboard.tsx` – static data
  - `MessagesPage.tsx` / `ChatPage.tsx` – hardcoded messages
  - `DocumentsPage.tsx` – static document list
  - `NotificationsPage.tsx` – no backend connection
  - `CollaborationRequestCard.tsx` – local state only

**Backend Project Created:**
```
nexus-backend/
├── src/
│   ├── config/database.js      # MongoDB connection with error handling
│   ├── models/                 # 5 Mongoose models
│   ├── controllers/            # 7 controllers
│   ├── routes/                 # 7 route files
│   ├── middleware/             # auth, error handler, file upload
│   └── utils/                 # jwt, email, response helpers
└── server.js                   # Express + Socket.io server
```

**Technology Stack:**
- Runtime: Node.js
- Framework: Express.js
- Database: MongoDB via Mongoose
- Auth: JWT (access + refresh tokens)
- Real-time: Socket.io
- File Storage: Cloudinary
- Email: Nodemailer
- Security: Helmet, CORS, express-rate-limit

---

## Milestone 2: User Authentication & Profiles

### Authentication System

**JWT Strategy:**
- Short-lived **access tokens** (7 days) sent in `Authorization: Bearer` header
- Long-lived **refresh tokens** (30 days) stored in DB and rotated on use
- Automatic token refresh in Axios interceptor (frontend `services/api.ts`)
- On refresh failure → clears storage + emits `auth:logout` event

**Endpoints Implemented:**
| Endpoint | Method | Details |
|----------|--------|---------|
| `/api/auth/register` | POST | Creates user, sends verification email, returns both tokens |
| `/api/auth/login` | POST | Validates credentials + role, returns tokens |
| `/api/auth/logout` | POST | Clears refresh token from DB, sets isOnline=false |
| `/api/auth/refresh-token` | POST | Issues new token pair |
| `/api/auth/me` | GET | Returns current user (auth required) |
| `/api/auth/forgot-password` | POST | Sends hashed reset token via email |
| `/api/auth/reset-password` | POST | Verifies token, updates password, invalidates sessions |
| `/api/auth/change-password` | PUT | Authenticated password change |

**Security Measures:**
- Passwords hashed with bcrypt (12 salt rounds) via `pre('save')` hook
- Reset tokens are SHA-256 hashed before DB storage (raw token sent in email only)
- Rate limiting: 20 auth requests per 15 minutes per IP
- Email enumeration protection on forgot-password (always returns success)

### Role-Based Access Control

```javascript
// Usage in any route:
router.post('/send-request', protect, restrictTo('investor'), sendRequest);
router.patch('/:id/respond', protect, restrictTo('entrepreneur'), respondToRequest);
```

### User Schema

Extended single `User` collection to avoid collection joins for the two roles:

```
Common: name, email, password, role, avatarUrl, bio, isOnline, isVerified, lastSeen

Entrepreneur fields: startupName, pitchSummary, fundingNeeded, industry, 
                     location, foundedYear, teamSize, website, linkedinUrl

Investor fields: investmentInterests[], investmentStage[], portfolioCompanies[],
                 totalInvestments, minimumInvestment, maximumInvestment, firmName
```

**Profile APIs:**
- `GET /api/users/profile/:id` – Public profile (no sensitive data)
- `PUT /api/users/profile` – Update own profile (whitelist of allowed fields)
- `POST /api/users/avatar` – Multer → Cloudinary upload, stores URL in DB
- `GET /api/users/entrepreneurs` – Paginated list with search, industry, location filters
- `GET /api/users/investors` – Paginated list with search, interests, stage filters

### Frontend Integration

- `src/services/api.ts` – Central Axios instance with:
  - Automatic token attachment on every request
  - 401 → token refresh → retry original request
  - All API calls organized by domain (`authAPI`, `usersAPI`, etc.)
- `src/services/socket.ts` – Socket.io client connecting with JWT auth
- `src/context/AuthContext.tsx` – Now calls real backend instead of mock data

---

## Decisions & Tradeoffs

| Decision | Rationale |
|----------|-----------|
| Single User collection (not separate Entrepreneur/Investor) | Simpler queries, no joins needed, both roles share 80% of fields |
| Memory storage for Multer | Files streamed directly to Cloudinary, no disk I/O on server |
| Soft deletes (`isActive: false`) | Preserves referential integrity in messages/meetings/notifications |
| Socket.io auth via handshake | Cleaner than per-message token validation |
| `toPublicJSON()` instance method | Consistent removal of sensitive fields across all endpoints |

---

## Deliverables Checklist

- [x] Backend project with all dependencies
- [x] MongoDB models with validation, indexes, and instance methods
- [x] JWT authentication (register, login, logout, refresh, forgot/reset password)
- [x] Role-based middleware (`protect`, `restrictTo`)
- [x] Profile CRUD + avatar upload
- [x] Paginated entrepreneur/investor listing with filters
- [x] Frontend service layer (`api.ts`, `socket.ts`)
- [x] AuthContext updated to use real API
- [x] `.env.example` files for both projects
- [x] README with full API reference and deployment guide
