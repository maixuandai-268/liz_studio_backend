# Event Flow Map - Liz Studio WebSocket Architecture

## 1. Task Management Flow

### CREATE TASK
```
Frontend (Admin)
  ↓
POST /api/tasks {title, projectId, ...}
  ↓
tasks.controller.ts (createTask)
  ↓
tasks.service.ts (create)
  ├─→ TypeORM save to DB
  ├─→ taskLogsService.createLog("task.created")
  │   └─→ task-logs.service.ts
  │       ├─→ Save audit trail to DB
  │       └─→ realtimeService.emit("timeline.created", {...})
  │
  └─→ realtimeService.emit("task.created", {...})
      ↓
      realtime.service.ts
      ├─→ this.server.to(`project-${projectId}`).emit("task:created", data)
      └─→ All clients in room receive event
          ↓
          Frontend SocketContext
          ├─→ Chat: update kanban board
          └─→ Timeline: show new audit entry
```

### UPDATE TASK
```
Frontend (Admin)
  ↓
PATCH /api/tasks/{id} {status, assignee, ...}
  ↓
tasks.service.ts (update)
  ├─→ Find & update in DB
  ├─→ taskLogsService.createLog("task.updated")
  │   └─→ emit("timeline.created")
  │
  └─→ realtimeService.emit("task.updated", {...})
      ↓
      Broadcast to project-{projectId} room
      ↓
      Frontend updates UI
```

### MOVE TASK (Between columns)
```
Frontend (Drag & Drop)
  ↓
PATCH /api/tasks/{id}/move {status: "in-progress" → "done"}
  ↓
tasks.service.ts (moveTask)
  ├─→ Update task.status in DB
  ├─→ taskLogsService.createLog("task.moved", {from: "in-progress", to: "done"})
  │   └─→ emit("timeline.created", {action: "moved", ...})
  │
  └─→ realtimeService.emit("task.moved", {...})
      ↓
      Broadcast: project-{projectId} room sees kanban update
      ↓
      All devices sync immediately
```

---

## 2. Chat Flow

### SEND MESSAGE
```
Frontend (Admin or Employee)
  ↓
socket.emit("chat:send", {projectId, message: "..."})
  ↓
realtime.gateway.ts (handleChatSend)
  ├─→ Verify JWT token + get user
  ├─→ Validate payload
  │
  └─→ chatService.sendMessage(projectId, userId, channelId, message)
      ↓
      chat.service.ts
      ├─→ Create Message entity in DB
      ├─→ realtimeService.emit("chat.message", {
      │     projectId, 
      │     channelId, 
      │     message, 
      │     author: user,
      │     timestamp
      │   })
      │
      └─→ realtime.service.ts
          ├─→ this.server.to(`project-${projectId}`).emit("chat:message", data)
          └─→ All clients in project room get new message
              ↓
              Frontend SocketContext updates messages array
              ↓
              ChatNoiBoSection re-renders with new message
```

### TYPING INDICATOR
```
Frontend
  ↓
socket.emit("chat:typing", {projectId, channelId})
  ↓
realtime.gateway.ts (handleChatTyping - if implemented)
  ↓
Broadcast to project-{projectId} room
  ↓
Other clients see "User is typing..." indicator
```

---

## 3. Online Status Flow

### USER COMES ONLINE
```
Frontend (Socket connects)
  ↓
handleConnection in realtime.gateway.ts
  ├─→ Verify JWT
  ├─→ Store in clientToUser Map
  └─→ socket.join(`user-${userId}`)
      ↓
      realtimeService.broadcastUserOnline(projectId, userId, userInfo)
      ├─→ this.server.to(`project-${projectId}`).emit("user:online", {userId, ...})
      └─→ All project members see user is online
          ↓
          Frontend SocketContext updates onlineUsers array
```

### USER GOES OFFLINE
```
Frontend (Socket disconnects / tab closes)
  ↓
handleDisconnect in realtime.gateway.ts
  ├─→ Get user from clientToUser Map
  ├─→ Delete entry
  └─→ realtimeService.broadcastUserOffline(projectId, userId)
      ├─→ this.server.to(`project-${projectId}`).emit("user:offline", {userId})
      └─→ All project members see user is offline
```

---

## 4. Room Management Flow

### JOIN PROJECT ROOM
```
Frontend (Navigate to project dashboard)
  ↓
socket.emit("room:join", {projectId})
  ↓
realtime.gateway.ts (handleRoomJoin)
  ├─→ Verify user
  ├─→ socket.join(`project-${projectId}`)
  └─→ realtimeService.broadcastUserOnline(...)
      ↓
      User now receives all events for this project:
      - task.created / updated / moved / deleted
      - chat.message
      - timeline.created
      - user.online / offline
```

### LEAVE PROJECT ROOM
```
Frontend (Navigate away from project)
  ↓
socket.emit("room:leave", {projectId})
  ↓
realtime.gateway.ts (handleRoomLeave)
  ├─→ Verify user
  ├─→ socket.leave(`project-${projectId}`)
  └─→ realtimeService.broadcastUserOffline(...)
      ↓
      User stops receiving project events
```

---

## 5. File-to-File Data Flow Summary

### Backend File Chain

**When Task is Created:**
```
POST /api/tasks
  ↓
tasks/tasks.controller.ts (route handler)
  ↓
tasks/tasks.service.ts (create method)
  │
  ├─→ Save to DB (via TypeORM)
  │
  ├─→ Inject: TaskLogsService
  │   ↓
  │   task-logs/task-logs.service.ts (createLog)
  │   ├─→ Save audit to DB
  │   ├─→ Inject: RealtimeService
  │   │   ↓
  │   │   realtime/realtime.service.ts (emit)
  │   │   ├─→ server.to(`project-${id}`).emit("timeline:created", ...)
  │   │   └─→ All room members receive
  │   └─→ Return Log entity
  │
  └─→ Inject: RealtimeService (directly from TasksService)
      ↓
      realtime/realtime.service.ts (emit)
      ├─→ server.to(`project-${id}`).emit("task:created", ...)
      └─→ All room members receive
```

**When Chat Message Sent:**
```
socket.emit("chat:send", {...})
  ↓
realtime/realtime.gateway.ts (handleChatSend)
  ├─→ Verify JWT token
  ├─→ Inject: ChatService
  │   ↓
  │   chat/chat.service.ts (sendMessage)
  │   ├─→ Save Message entity to DB
  │   ├─→ Inject: RealtimeService
  │   │   ↓
  │   │   realtime/realtime.service.ts (emit)
  │   │   └─→ server.to(`project-${id}`).emit("chat:message", ...)
  │   └─→ Return Message entity
  │
  └─→ Acknowledge to sender via socket response
```

### Frontend File Chain

**When Socket Receives Event:**
```
Socket connection established
  ↓
lib/socket.ts (singleton client)
  ├─→ on("task:created", (data) => setTasks([...]))
  ├─→ on("chat:message", (data) => setMessages([...]))
  ├─→ on("user:online", (user) => setOnlineUsers([...]))
  └─→ on("user:offline", (userId) => removeFromOnlineUsers(...))
      ↓
      context/SocketContext.tsx (provider)
      ├─→ Manage: messages, tasks, onlineUsers, typingUsers
      ├─→ Provide via React Context
      └─→ Components consume via useSocket()
          ↓
          app/local/admin/dashboard/ChatNoiBoSection.tsx
          ├─→ Display messages
          ├─→ Show online users
          ├─→ Handle input/send
          └─→ Real-time sync
          
          app/local/admin/dashboard/KanbanBoard.tsx (if exists)
          ├─→ Display tasks
          ├─→ Handle drag-drop
          └─→ Real-time update on task.moved
```

---

## 6. Event Types Reference

| Event | From | To | Purpose |
|-------|------|-----|---------|
| `task:created` | TasksService | RealtimeGateway → All clients | New task created |
| `task:updated` | TasksService | RealtimeGateway → All clients | Task fields changed |
| `task:moved` | TasksService | RealtimeGateway → All clients | Task status changed |
| `task:deleted` | TasksService | RealtimeGateway → All clients | Task removed |
| `timeline:created` | TaskLogsService | RealtimeGateway → All clients | Audit log entry |
| `chat:message` | ChatService | RealtimeGateway → All clients | New chat message |
| `user:online` | RealtimeGateway | All clients in room | User connected |
| `user:offline` | RealtimeGateway | All clients in room | User disconnected |
| `ping` / `pong` | Client / Gateway | Keep-alive heartbeat |
| `room:join` / `room:leave` | Client | RealtimeGateway | Room subscription |

---

## 7. Dependency Injection Chain

```
RealtimeGateway (centralized)
  ├─→ Inject: RealtimeService
  ├─→ Inject: ChatService
  └─→ Inject: JwtService

TasksService
  ├─→ Inject: TaskLogsService
  └─→ Inject: RealtimeService

TaskLogsService
  └─→ Inject: RealtimeService

ChatService
  └─→ Inject: RealtimeService

RealtimeService
  └─→ Has: Socket.IO Server instance
```

---

## Key Points

- **Single source of truth:** RealtimeService manages all socket.io emissions
- **Centralized Gateway:** RealtimeGateway handles all WebSocket connections/messages
- **Event-driven:** Services don't know about clients; they just emit events
- **Room-based:** Events broadcast to `project-{projectId}` rooms only
- **Frontend sync:** SocketContext keeps UI in sync with all events
- **No polling:** All updates are push-based via WebSocket

