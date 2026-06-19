# CHANGELOG - liz_studio_backend

## 2026-06-19 — WebSocket Centralized Architecture

### Goal
Refactor realtime system: consolidate **all** WebSocket logic vào 1 Gateway duy nhất (RealtimeGateway). Không được tạo ChatGateway, TaskGateway, etc.

### Done
- [x] Tạo `RealtimeGateway` — duy nhất WS handler cho all events
  - Xác thực JWT token
  - Join/Leave project rooms
  - Handle chat:send
  - Broadcast user online/offline
- [x] Tạo `RealtimeService` — emit events (task, timeline, chat, notification)
- [x] Tạo `RealtimeModule` — exports RealtimeService
- [x] Tạo `JwtWsAuthGuard` — verify token trước connection
- [x] Tạo `TaskLogsService` + `TaskLog` entity — timeline audit trail
- [x] Tạo `TaskLogsModule`
- [x] Update `TasksService` — emit task.created/updated/moved/deleted + create timeline
- [x] Update `TasksModule` — import Realtime + TaskLogs
- [x] Update `ChatService` — emit chat.message events
- [x] Update `ChatModule` — import Realtime
- [x] Xóa `ChatGateway` cũ — consolidate vào Realtime
- [x] Update `AppModule` — import order (Realtime → TaskLogs → Tasks → Chat)
- [x] Fix `tsconfig.json` — add path alias `@/*`
- [x] Fix TypeScript errors — type casts, imports, entity schema
- [x] Build success ✅

### Architecture
```
RealtimeGateway (duy nhất)
  ├── JwtWsAuthGuard (auth)
  ├── room:join
  ├── room:leave
  ├── chat:send → ChatService → RealtimeService.emitChatMessage()
  └── ...

TasksService
  ├── createTask() → RealtimeService.emitTaskEvent('created')
  ├── updateTask() → TaskLogsService.createLog() → emitTimelineEvent()
  ├── moveTask() → emitTaskEvent('moved')
  └── deleteTask() → emitTaskEvent('deleted')

ChatService
  └── sendMessage() → RealtimeService.emitChatMessage()

RealtimeService
  └── Broadcast events → Socket.IO rooms
```

### Events
- `task.created` / `task.updated` / `task.moved` / `task.deleted`
- `timeline.created`
- `chat.message`
- `notification.created`
- `user.online` / `user.offline`

### Room Structure
- `project-{projectId}`: chat + task updates + timeline
- `user-{userId}`: personal notifications

### Next Steps
- Frontend: consume events via socket singleton
- Add notifications realtime
- Add task assignments realtime

---

## 2026-06-18

### Sync DB schema theo drawDB
- Đối chiếu toàn bộ entity với schema drawDB
- Tạo mới 11 entity files (trước đó 0 byte)
- Sửa 2 entity sai nội dung:
  - `task-activity.entity.ts`: từ copy User → TaskActivity đúng
  - `employee-kpi.entity.ts`: từ sai TaskAssignee → EmployeeKpi đúng
- Tạo mới 7 module files (trước đó 0 byte)
- Update `chat.module.ts`: thêm TypeOrmForFeature
- Update `app.module.ts`: import đủ 13 modules
