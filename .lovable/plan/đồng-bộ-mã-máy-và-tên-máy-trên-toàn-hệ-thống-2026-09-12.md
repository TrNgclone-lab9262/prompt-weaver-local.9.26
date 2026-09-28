# Đồng bộ mã máy và tên máy trên toàn hệ thống

## Vì sao tên máy chưa xuất hiện

Đã kiểm tra mã nguồn và thấy hai nguyên nhân:

1. Khi nạp CSV, tên máy chỉ được ghi lúc **tạo máy mới**. Nếu mã máy đã có sẵn trong hệ thống, phần `machine_name` (và `workshop`) trong file bị bỏ qua, máy giữ nguyên tên cũ.
2. Hầu hết các màn hình chỉ hiển thị **mã máy**: Bảng điều khiển, Timeline, Shinko Risuto, Lệnh sản xuất, Công việc của tôi. Trang Máy hiện có tên nhưng cách hiển thị không thống nhất với các trang khác.

## Sẽ thay đổi

### 1. Nạp CSV luôn cập nhật tên máy
- Khi mã máy đã tồn tại: cập nhật tên máy và xưởng nếu file có giá trị mới (không xóa tên cũ khi ô trống).
- Khi mã máy chưa có: tạo mới như hiện nay.
- Ghi vào nhật ký nạp: những máy vừa được đổi tên, để người nạp thấy rõ.

### 2. Một cách hiển thị tên máy duy nhất cho cả hệ thống
- Thêm một hàm hiển thị dùng chung, quy ước: `MC-01 — Mazak VCN-01`; nếu máy chưa có tên riêng thì chỉ hiện mã.
- Áp dụng cho: Bảng điều khiển, Timeline (nhãn hàng máy và bộ lọc), Shinko Risuto, Lệnh sản xuất (ô chọn máy và cột máy), Công việc của tôi, trang Máy.
- Nơi cột quá hẹp (nhãn hàng trong Timeline) hiển thị mã đậm ở trên, tên nhỏ bên dưới, để không vỡ bố cục.

### 3. Giữ đồng bộ về sau
- Mọi truy vấn máy đều lấy cả mã và tên (hiện có chỗ chỉ lấy mã), nên tên mới sẽ tự lan ra mọi màn hình sau mỗi lần nạp hoặc sửa.
- Trang Máy cho quản lý sửa trực tiếp tên máy và xưởng, có ghi nhật ký thay đổi.

## Chi tiết kỹ thuật

- `src/routes/_authenticated/import.tsx`: `ensureMachine` chuyển sang tìm theo `code`, nếu có thì `update` `name`/`workshop` khi giá trị khác và không rỗng; cache giữ cả tên đã cập nhật để tránh gọi lặp.
- `src/lib/mes.ts`: thêm `machineLabel({ code, name })`.
- Sửa `select("id, code")` thành `select("id, code, name")` trong `work-orders.tsx`, `my-jobs.tsx`; các trang còn lại đã `select("*")`.
- Thay chỗ hiển thị `m.code` bằng `machineLabel(m)` ở `dashboard.tsx`, `timeline.tsx`, `shinko.tsx`, `work-orders.tsx`, `my-jobs.tsx`, `machines.tsx`.
- `machines.tsx`: thêm ô sửa tên/xưởng cho vai trò quản lý, gọi `logAudit("MACHINE_EDIT", ...)`.

## Ngoài phạm vi

Không đổi cấu trúc cơ sở dữ liệu (bảng `machines` đã có `name`, `workshop`), không đổi bộ cột CSV đã thống nhất.
