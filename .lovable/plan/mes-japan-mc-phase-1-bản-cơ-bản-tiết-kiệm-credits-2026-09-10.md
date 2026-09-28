# MES JAPAN MC — Phase 1 (bản cơ bản, tiết kiệm credits)

## Điều chỉnh so với prompt gốc
Prompt yêu cầu Python/FastAPI/PostgreSQL/Redis/Docker. Trên Lovable không chạy được Python;
thay bằng nền tảng tương đương: giao diện React + Lovable Cloud (cơ sở dữ liệu PostgreSQL,
đăng nhập, quyền truy cập ở phía máy chủ). Toàn bộ nghiệp vụ, phân quyền 3 role và dữ liệu
đều giữ đúng yêu cầu; phần Docker/on-premise để lại cho giai đoạn sau.

## Phạm vi Phase 1 (làm ngay)
1. **Đăng nhập + 3 vai trò**: ADMIN / LEADER / OPERATOR, bảng vai trò riêng, kiểm tra quyền ở
   máy chủ (RLS), menu hiện theo quyền.
2. **Dashboard KPI**: Running / Waiting / Breakdown / Delay / Planned / Actual / Good / NG /
   Achievement %.
3. **Production Timeline (lõi cũ, giữ nguyên tinh thần)**: timeline theo máy, thanh Plan (màu
   theo mã hàng) + thanh Actual màu vàng, vạch giờ hiện tại, tô Thứ 7 (xanh) / CN (đỏ) /
   hôm nay, zoom Ngày/Tuần/Tháng, lọc theo máy và trạng thái.
4. **Shinko Risuto (進行リスト)**: bảng tiến độ, tô xanh hoàn thành / vàng cảnh báo, bấm mã hàng
   mở Job Timeline (trang 3 như bản HTML).
5. **Work Order**: danh sách + tạo/sửa (Leader/Admin), gán máy, trạng thái.
6. **My Jobs (Operator)**: Start / Pause / Complete, nhập Good Qty, NG Qty, Remark.
7. **Machine Status**: RUN / WAIT / SETUP / BREAKDOWN / MAINTENANCE / OFFLINE, báo hỏng máy.
8. **Import CSV cũ**: nạp plan.csv / actual.csv / master.csv đúng định dạng hiện tại (kể cả
   ngày M/D/YYYY) vào cơ sở dữ liệu.
9. **Audit log** cho các thao tác quan trọng + dữ liệu mẫu (máy, work order, bản ghi sản xuất).

## Để giai đoạn sau (chưa làm ở Phase 1)
OEE chi tiết, Downtime analytics, Quality/NCR, Traceability, Inventory/WIP, Maintenance,
Tool Management, Skill Matrix, APS finite-capacity, Andon, Notification Center, QR scan,
báo cáo nâng cao, realtime WebSocket (Phase 1 dùng tự làm mới định kỳ).

## Kỹ thuật
- Bảng: `profiles`, `user_roles`, `machines`, `work_orders`, `operations/jobs`,
  `production_records`, `machine_status_log`, `audit_logs`.
- RLS theo hàm `has_role()`; Operator chỉ thấy/sửa job được giao.
- Timeline: FullCalendar Scheduler (resource timeline) trong React, giữ bảng màu và CSS của
  bản HTML hiện tại (header xanh #16a34a, actual #fff9c4, delay đỏ, completed xanh).
- Giao diện dày thông tin, chữ nhỏ 11px, phù hợp màn hình xưởng; song ngữ nhãn JP/EN như bản cũ.
