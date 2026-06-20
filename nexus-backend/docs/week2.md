# Week 2 Documentation – Nexus Platform

**Duration:** Week 2 of 3  
**Focus:** Meeting Scheduling, Collaboration System, Documents, Real-time Messaging

---

## Milestone 3: Meeting Scheduling System

### Meeting Model

```javascript
// Key fields
{
  title, description, organizer (ref: User), attendee (ref: User),
  scheduledAt: Date, duration: Number (minutes),
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed',
  meetingType: 'video_call' | 'phone_call' | 'in_person',
  meetingLink: String,   // Auto-generated Jitsi URL for video calls
  agenda: String,
  rejectionReason: String,
  endTime: virtual       // scheduledAt + duration (in ms)
}
```

### Conflict Detection

The `Meeting.checkConflict()` static method prevents double-booking:

```javascript
// Checks if userId has any accepted/pending meeting that overlaps
// with the proposed [scheduledAt, scheduledAt + duration] window
meetingSchema.statics.checkConflict = async (userId, scheduledAt, duration, excludeId) => {
  const startTime = new Date(scheduledAt);
  const endTime = new Date(startTime.getTime() + duration * 60000);

  return Meeting.findOne({
    $or: [{ organizer: userId }, { attendee: userId }],
    status: { $in: ['pending', 'accepted'] },
    scheduledAt: { $lt: endTime },
    // endTime of existing meeting > proposed startTime
    $expr: { $gt: [{ $add: ['$scheduledAt', { $multiply: ['$duration', 60000] }] }, startTime] }
  });
};
```

Conflict detection runs for **both** the organizer and attendee before creating a meeting.

### Meeting Lifecycle

```
[Organizer schedules] → pending
                           ↓
              [Attendee responds]
           ↙                    ↘
       accepted               rejected
           ↓
    [After meeting time]
       completed
           
[Organizer cancels at any time] → cancelled
```

### Meeting Endpoints

| Endpoint | Auth | Role | Description |
|----------|------|------|-------------|
| `POST /api/meetings` | ✅ | Any | Schedule (conflict check runs) |
| `GET /api/meetings` | ✅ | Any | List own meetings |
| `GET /api/meetings?upcoming=true` | ✅ | Any | Upcoming only |
| `GET /api/meetings/:id` | ✅ | Participant | Get meeting details |
| `PUT /api/meetings/:id` | ✅ | Organizer | Edit (re-runs conflict check) |
| `PATCH /api/meetings/:id/respond` | ✅ | Attendee | Accept or reject |
| `PATCH /api/meetings/:id/cancel` | ✅ | Organizer | Cancel |

### Notifications on Meeting Events

Every meeting action triggers:
1. **In-app notification** via `Notification.create()`
2. **Real-time Socket.io push** to the recipient's room (`user:{id}`)
3. **Email notification** via Nodemailer (non-blocking, won't fail the request)

| Action | Recipient | Notification Type |
|--------|-----------|------------------|
| Meeting scheduled | Attendee | `meeting_scheduled` |
| Meeting accepted | Organizer | `meeting_accepted` |
| Meeting rejected | Organizer | `meeting_rejected` |
| Meeting cancelled | Attendee | `meeting_cancelled` |

### Frontend: MeetingsPage

New page at `/meetings` accessible from both role sidebars.

**Features:**
- Upcoming / All tabs
- Date-block cards showing month + day
- Status badges (pending=yellow, accepted=green, rejected/cancelled=red)
- Meeting type icons (Video/Phone/In-person)
- **Accept / Reject buttons** for attendees on pending meetings
- **Cancel button** for organizers
- **Join button** linking to auto-generated Jitsi URL
- **Schedule Meeting modal** with:
  - Dropdown populated from live API (entrepreneurs or investors based on role)
  - Date/time picker (past dates blocked)
  - Duration selector (15/30/45/60/90/120 min)
  - Meeting type selector
  - Optional description & agenda

---

## Collaboration Request System

Full lifecycle for investor→entrepreneur collaboration:

```
Investor sends request → Entrepreneur receives notification
                              ↓
              Entrepreneur accepts or rejects
                    ↓               ↓
          Investor notified    Investor notified
```

**Double-request prevention:** Only one `pending` request allowed per investor-entrepreneur pair.

---

## Document System

- Files stored on **Cloudinary** (raw resource type for non-images)
- Metadata stored in MongoDB `Document` collection
- Per-document sharing with `view` or `download` permission per user
- Download tracking via counter increment
- Categories: `pitch_deck`, `financials`, `legal`, `market_research`, `business_plan`, `other`

---

## Real-time Architecture

Socket.io server integrated directly into Express via `http.createServer()`:

```
Client authenticates → JWT verified in Socket middleware → joins `user:{id}` room
                    
API controller triggers event → io.to(`user:{recipientId}`).emit('notification', data)
```

**Rooms used:**
- `user:{userId}` – Personal room for notifications and messages
- `meeting:{meetingId}` – Meeting room for video call participants

---

## Deliverables Checklist

- [x] Meeting scheduling API with conflict detection
- [x] Full meeting lifecycle (pending → accepted/rejected → cancelled)
- [x] Meeting notifications (in-app + Socket.io + email)
- [x] `MeetingsPage.tsx` with schedule modal and respond/cancel actions
- [x] Meetings route in sidebar for both user roles
- [x] Collaboration request system (send/respond/withdraw)
- [x] Document upload/share/download via Cloudinary
- [x] Message API with conversation aggregation
- [x] Notification system (create/read/mark-all-read/delete)
- [x] Socket.io events for typing indicators and online status
