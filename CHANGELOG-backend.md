# CHANGELOG - liz_studio_backend

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
