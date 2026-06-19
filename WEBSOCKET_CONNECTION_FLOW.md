# WebSocket Connection Flow - Chi Tiết

## 1. CONNECTION INITIATION (Frontend)

```typescript
// lib/socket.ts (Frontend)
const socket = io('http://localhost:3001', {
  query: {
    token: jwtToken  // ← Token đi qua query params
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  transports: ['websocket', 'polling']
});
```

**Step 1: Frontend gửi handshake request**
```
Frontend (lib/socket.ts)
  ↓
IO Client library
  ↓
HTTP Upgrade request (WebSocket handshake)
  headers:
    - Connection: upgrade
    - Upgrade: websocket
  query:
    - token=eyJhbGciOiJIUzI1NiIs...
  ↓
Server (localhost:3001)
```

---

## 2. GATEWAY RECEIVES CONNECTION (Backend)

```typescript
// src/modules/realtime/realtime.gateway.ts
@WebSocketGateway({
  cors: { origin: 'http://localhost:3000', credentials: true },
  transports: ['websocket', 'polling']
})
export class RealtimeGateway {
  handleConnection(@ConnectedSocket() client: Socket) {
    // ← Called when client connects
    // client.handshake contains token & headers
  }
}
```

**Step 2: Gateway receives connection**
```
Socket.IO Server (port 3001)
  ↓
RealtimeGateway.handleConnection() triggered
  ├─ client.id = socket connection ID (e.g., "Wnw91213d-AAAB")
  ├─ client.handshake.query = { token: "..." }
  ├─ client.handshake.headers = { authorization, ... }
  └─ client.handshake.address = client IP
```

---

## 3. JWT TOKEN VERIFICATION

```typescript
// Inside RealtimeGateway.handleConnection()
const token = 
  client.handshake.query.token ||
  client.handshake.headers.authorization?.split(' ')[1];

const user = this.jwtService.verify(token, {
  secret: process.env.JWT_SECRET
});

// Result: user = { sub: "user-123", role: "admin", ... }
```

**Step 3: Verify token**
```
Token extraction
  token = "eyJhbGciOiJIUzI1NiIs..."
  ↓
JwtService.verify(token, secret)
  ├─ Decode token
  ├─ Verify signature
  ├─ Check expiration
  └─ Return decoded payload: {sub: userId, role, iat, exp}
     ↓
     ✅ Valid? → Continue
     ❌ Invalid/Expired? → Disconnect client
```

---

## 4. CONNECTION VALIDATION & STORAGE

```typescript
if (!user) {
  logger.warn(`[CONNECTION] Rejected: ${client.id}`);
  client.disconnect();  // ← Reject connection
  return;
}

// Store user info
this.clientToUser.set(client.id, {
  userId: user.sub,
  role: user.role
});

logger.log(`[CONNECTION] User ${user.sub} connected: ${client.id}`);
```

**Step 4: Validate & store**
```
Validate user
  ├─ Extract userId from token.sub
  ├─ Extract role from token.role
  ├─ Validate against DB? (optional)
  └─ Store in memory: clientToUser.set(socketId, {userId, role})
      ↓
      Map example:
      {
        "Wnw91213d-AAAB": { userId: "user-123", role: "admin" },
        "Wnw91213d-AAAC": { userId: "user-456", role: "employee" }
      }
```

---

## 5. AUTO-JOIN USER ROOM

```typescript
// In handleConnection (after validation)
client.join(`user-${user.sub}`);
// client is now in room: "user-123"
```

**Step 5: Auto-join personal room**
```
Socket joins room: user-{userId}
  ├─ Purpose: Receive personal notifications
  ├─ Example: user-123 joins room "user-123"
  └─ Now receives events emitted to this room
     socket.to('user-123').emit('notification:created', {...})
```

---

## 6. BROADCAST USER ONLINE STATUS

```typescript
// Inside handleConnection
this.realtimeService.broadcastUserOnline(projectId, user.userId, {
  id: user.userId,
  role: user.role
});
```

```typescript
// In realtime.service.ts
broadcastUserOnline(projectId: string, userId: string, userInfo: any) {
  this.server
    .to(`project-${projectId}`)
    .emit('user:online', { userId, userInfo, timestamp });
}
```

**Step 6: Broadcast online status**
```
RealtimeService.broadcastUserOnline()
  ↓
socket.io server
  ├─ Find all sockets in room "project-{projectId}"
  ├─ Send event: { type: 'user:online', userId, userInfo, timestamp }
  └─ All connected clients in project room receive
      ↓
      Frontend SocketContext updates onlineUsers array
      ↓
      UI shows user is online
```

---

## 7. CLIENT READY STATE

```typescript
// At this point, client is ready to:
// 1. Receive events
// 2. Send messages
// 3. Join/leave rooms

socket.on('task:created', (data) => { /* handle */ });
socket.on('chat:message', (data) => { /* handle */ });
socket.emit('room:join', { projectId: 'proj-123' });
```

**Step 7: Connection established & ready**
```
Frontend Socket State: CONNECTED ✅
  ├─ Can send events: socket.emit(...)
  ├─ Can receive events: socket.on(...)
  ├─ Auto-subscribed to: user-{userId}
  └─ Ready to subscribe to project rooms
```

---

## 8. JOIN PROJECT ROOM

```typescript
// Frontend (when navigating to project)
socket.emit('room:join', { projectId: 'proj-123' });
```

```typescript
// Backend gateway
@SubscribeMessage('room:join')
handleRoomJoin(
  @ConnectedSocket() client: Socket,
  @MessageBody() payload: { projectId: string }
) {
  const user = this.clientToUser.get(client.id);
  const room = `project-${payload.projectId}`;
  
  client.join(room);  // ← Socket joins project room
  
  this.realtimeService.broadcastUserOnline(
    payload.projectId,
    user.userId,
    { id: user.userId, role: user.role }
  );
  
  return { success: true, room, projectId: payload.projectId };
}
```

**Step 8: Join project room**
```
Frontend: socket.emit('room:join', {projectId: 'proj-123'})
  ↓
Backend: handleRoomJoin() triggered
  ├─ Get user from clientToUser Map
  ├─ socket.join(`project-123`)
  │   ├─ Socket now in rooms: ["user-123", "project-123"]
  │   └─ Can receive events targeted to either room
  │
  ├─ Broadcast: user-123 is online in project-123
  │   ↓
  │   All other clients in project-123 room see:
  │   { type: 'user:online', userId: 'user-123', ... }
  │
  └─ Send acknowledgment back to client
      ↓
      Frontend receives: { success: true, room: 'project-123' }
      ↓
      Update UI: show project dashboard
```

---

## 9. READY TO EXCHANGE EVENTS

```
After room:join, client is in rooms:
  - "user-123" (personal)
  - "project-123" (project)

Now can receive:
  ├─ Personal events: socket.to('user-123').emit(...)
  ├─ Project events: socket.to('project-123').emit(...)
  └─ Broadcast: socket.emit(...) (all connected clients)

And can send:
  ├─ chat:send
  ├─ room:leave
  ├─ ping (keep-alive)
  └─ Any custom events
```

**Step 9: Event exchange ready**
```
Example: Task created
  Frontend (Admin)
    ↓ POST /api/tasks
  Backend TasksService
    ↓ emit task:created
  RealtimeService
    ↓ server.to('project-123').emit('task:created', {...})
  All clients in project-123 room
    ↓
  Frontend SocketContext
    ↓
  UI updates (Kanban board refresh)
```

---

## 10. KEEP-ALIVE / HEARTBEAT

```typescript
// Frontend (optional)
setInterval(() => {
  socket.emit('ping', {});
}, 30000);  // Every 30 seconds

// Backend
@SubscribeMessage('ping')
handlePing() {
  return { pong: true };
}
```

**Step 10: Keep-alive**
```
Every 30 seconds:
  Frontend: socket.emit('ping')
    ↓
  Backend: handlePing()
    ↓
  Response: { pong: true }
    ↓
  Frontend receives pong
    ↓
  Keep connection alive (prevent timeout)
```

---

## 11. LEAVE PROJECT ROOM

```typescript
// Frontend (when navigating away)
socket.emit('room:leave', { projectId: 'proj-123' });
```

```typescript
// Backend
@SubscribeMessage('room:leave')
handleRoomLeave(
  @ConnectedSocket() client: Socket,
  @MessageBody() payload: { projectId: string }
) {
  const user = this.clientToUser.get(client.id);
  const room = `project-${payload.projectId}`;
  
  client.leave(room);  // ← Socket leaves project room
  
  this.realtimeService.broadcastUserOffline(payload.projectId, user.userId);
  
  return { success: true, room };
}
```

**Step 11: Leave room**
```
Frontend: socket.emit('room:leave', {projectId})
  ↓
Backend: handleRoomLeave()
  ├─ socket.leave('project-123')
  │   └─ Socket now only in: ["user-123"]
  │
  ├─ Broadcast: user-123 is offline in project-123
  │   ↓
  │   Other clients see: { type: 'user:offline', userId: 'user-123' }
  │
  └─ Acknowledge
```

---

## 12. DISCONNECT / OFFLINE

```typescript
// Backend
handleDisconnect(@ConnectedSocket() client: Socket) {
  const user = this.clientToUser.get(client.id);
  
  if (user) {
    logger.log(`[DISCONNECT] User ${user.userId}: ${client.id}`);
    this.clientToUser.delete(client.id);
    // Optional: Broadcast offline to all projects user was in
  }
}
```

**Step 12: Client disconnect**
```
Network issue / Tab close / Logout
  ↓
Socket disconnects
  ↓
Backend: handleDisconnect() triggered
  ├─ Get user from clientToUser Map
  ├─ Delete entry
  └─ Optional: Broadcast offline status
      ↓
      Other clients see user went offline
```

---

## Full Connection Lifecycle Timeline

```
T=0s    | Frontend initiates connection (io(...))
        ├─ HTTP Upgrade request + token in query
        └─→ Backend

T=0.05s | RealtimeGateway.handleConnection()
        ├─ Extract token from handshake.query
        ├─ JwtService.verify(token)
        ├─ Validate user
        ├─ Store in clientToUser Map
        ├─ socket.join('user-{userId}')
        ├─ Broadcast user online (if in project)
        └─→ Send acknowledgment to client

T=0.1s  | Frontend receives connection ACK
        ├─ socket.connected = true
        ├─ Update UI: "Connected"
        └─→ Ready for events

T=1s    | Frontend: socket.emit('room:join', {projectId})
        ├─ Send join request
        └─→ Backend

T=1.05s | Backend: handleRoomJoin()
        ├─ socket.join('project-{projectId}')
        ├─ Broadcast: user online in project
        └─→ Send ACK + room info

T=1.1s  | Frontend receives room:join ACK
        ├─ Now subscribed to project events
        ├─ Update dashboard
        └─→ Ready for task/chat events

T=1+∞   | Events flow:
        ├─ Task created → broadcast to project-{id} room
        ├─ Chat message → broadcast to project-{id} room
        ├─ User typing → broadcast to project-{id} room
        └─ Keep-alive ping every 30s

T=∞-5s  | Frontend: socket.emit('room:leave', {projectId})
        ├─ Leave project room
        └─→ Broadcast offline in project

T=∞     | Network disconnect / Tab close
        ├─ handleDisconnect() triggered
        ├─ Delete from clientToUser
        └─→ Broadcast offline
```

---

## Error Handling During Connection

```
Scenario 1: Invalid Token
  ├─ JwtService.verify() throws
  ├─ catch block returns null
  ├─ client.disconnect()
  └─ Frontend: connection fails → retry with login

Scenario 2: Token Expired
  ├─ JwtService.verify() throws (exp check)
  ├─ client.disconnect()
  └─ Frontend: need refresh token → call /api/auth/refresh

Scenario 3: Network Timeout
  ├─ TCP connection not established
  ├─ Frontend socket.io auto-reconnects
  └─ Retry with exponential backoff (1s, 2s, 4s, 8s, 16s)

Scenario 4: Server Down
  ├─ Connection refused (ECONNREFUSED)
  ├─ Frontend auto-reconnect with fallback to polling
  └─ Retry up to 5 times (reconnectionAttempts)
```

---

## Socket Rooms Visualization

```
After successful connection + room:join:

┌─────────────────────────────────────────────────────┐
│  Socket.IO Server (port 3001)                       │
│                                                     │
│  Room: "user-123"                                   │
│  ├─ Client A (socket-id-001)  [User-123, Admin]    │
│  └─ Can receive: personal notifications             │
│                                                     │
│  Room: "user-456"                                   │
│  ├─ Client B (socket-id-002)  [User-456, Employee] │
│  └─ Can receive: personal notifications             │
│                                                     │
│  Room: "project-123"                                │
│  ├─ Client A (socket-id-001)  [User-123, Admin]    │
│  ├─ Client B (socket-id-002)  [User-456, Employee] │
│  └─ Can receive: task.*, chat.*, user.*, timeline.*│
│                                                     │
│  Room: "project-456"                                │
│  ├─ Client A (socket-id-001)  [User-123, Admin]    │
│  └─ Can receive: events for project-456 only       │
│                                                     │
└─────────────────────────────────────────────────────┘

Events to specific room:
  server.to('project-123').emit('task:created', data)
  → Sent to: Client A, Client B (both in project-123)

Events to all:
  server.emit('broadcast', data)
  → Sent to: Client A, Client B (all connected)

Events to specific user:
  server.to('user-123').emit('notification', data)
  → Sent to: Client A only
```

---

## Frontend Socket Connection Code

```typescript
// lib/socket.ts
import io from 'socket.io-client';

const jwtToken = localStorage.getItem('token');

export const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001', {
  query: { token: jwtToken },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('[SOCKET] Connected:', socket.id);
  // Ready to emit events
});

socket.on('disconnect', (reason) => {
  console.log('[SOCKET] Disconnected:', reason);
  // Clean up, notify user
});

socket.on('connect_error', (error) => {
  console.error('[SOCKET] Connection error:', error.message);
  // Show error notification
});
```

