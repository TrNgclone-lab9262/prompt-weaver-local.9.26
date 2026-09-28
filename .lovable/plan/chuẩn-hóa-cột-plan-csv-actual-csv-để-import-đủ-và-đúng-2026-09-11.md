# Chuẩn hóa cột plan.csv / actual.csv để import đủ và đúng

## Vấn đề hiện nay

Bộ nạp dữ liệu hiện chỉ đọc một phần cột của file cũ, nên nhiều thông tin bị bỏ rơi:

- plan.csv: chỉ dùng `Ma_Hang`, `Ten_May`, `Ten_Cong_Doan`, `Ngay_Bat_Dau`, `Ngay_Ket_Thuc`, `Qty`, `Status`, `Memo`, `WO`, `ma_ban_ve`. Không có cột cho khách hàng, ngày giao, độ ưu tiên, tên máy đầy đủ, xưởng.
- actual.csv: chỉ dùng `ma_ban_ve`, `thoi_diem_bat_dau`, `thoi_diem_hoan_thanh`. Các cột `may_gia_cong`, `thu_tu_gc`, `trang_thai` và số lượng đạt/hỏng, người vận hành đều bị bỏ qua.
- Ghép actual với plan đang dựa vào mã bản vẽ, dễ ghép nhầm khi một mã có nhiều công đoạn.

## Bộ cột đề xuất

### plan.csv (mỗi dòng = 1 công đoạn cần chạy)

| Tên cột | Bắt buộc | Ý nghĩa |
|---|---|---|
| `wo_number` | Có | Mã lệnh sản xuất, duy nhất. Đây cũng là khóa để actual ghép vào |
| `part_number` | Có | Mã hàng |
| `part_name` | Không | Tên hàng |
| `drawing_number` | Không | Mã bản vẽ |
| `customer` | Không | Khách hàng |
| `quantity` | Có | Số lượng kế hoạch |
| `operation` | Có | Tên công đoạn |
| `operation_seq` | Không | Thứ tự công đoạn (1, 2, 3…) |
| `machine_code` | Có | Mã máy ngắn, ví dụ MC-01 |
| `machine_name` | Không | Tên máy đầy đủ, dùng khi máy chưa có trong hệ thống |
| `workshop` | Không | Xưởng, mặc định MC |
| `plan_start` | Có | Bắt đầu kế hoạch, `YYYY-MM-DD HH:mm` |
| `plan_end` | Có | Kết thúc kế hoạch, `YYYY-MM-DD HH:mm` |
| `due_date` | Không | Hạn giao, `YYYY-MM-DD` |
| `priority` | Không | 1 = gấp nhất, mặc định 3 |
| `status` | Không | PLANNED / IN_PROGRESS / COMPLETED / HOLD / CANCELLED |
| `remark` | Không | Ghi chú |

### actual.csv (mỗi dòng = kết quả chạy thật của 1 công đoạn)

| Tên cột | Bắt buộc | Ý nghĩa |
|---|---|---|
| `wo_number` | Có | Ghép chính xác với dòng trong plan.csv |
| `operation_seq` | Không | Khi 1 lệnh có nhiều công đoạn |
| `machine_code` | Không | Máy thực tế chạy, có thể khác kế hoạch |
| `operator_code` | Không | Mã nhân viên vận hành |
| `actual_start` | Không | Bắt đầu thực tế |
| `actual_end` | Không | Kết thúc thực tế |
| `good_qty` | Không | Số lượng đạt |
| `ng_qty` | Không | Số lượng hỏng |
| `job_status` | Không | PLANNED / RUNNING / PAUSED / COMPLETED |
| `remark` | Không | Ghi chú |

Quy ước chung: tên cột chữ thường, không dấu, nối bằng gạch dưới; ngày giờ dùng `YYYY-MM-DD HH:mm`; ô trống để rỗng, không ghi "null".

## Tương thích ngược với file cũ

Không bắt bạn sửa file cũ bằng tay. Bộ nạp sẽ nhận cả hai kiểu tên cột qua bảng quy đổi:

```text
Ma_Hang            -> part_number       ma_ban_ve            -> drawing_number
Ten_Hang           -> part_name         may_gia_cong         -> machine_code
Ten_May            -> machine_code      thu_tu_gc            -> operation_seq
Ten_Cong_Doan      -> operation         thoi_diem_bat_dau    -> actual_start
Ngay_Bat_Dau       -> plan_start        thoi_diem_hoan_thanh -> actual_end
Ngay_Ket_Thuc      -> plan_end          trang_thai           -> job_status
Qty                -> quantity          so_luong_dat         -> good_qty
Status             -> status            so_luong_hong        -> ng_qty
Memo / Ghi_Chu     -> remark            nguoi_gia_cong       -> operator_code
WO / So_Lenh       -> wo_number         Khach_Hang           -> customer
```

Khi thiếu `wo_number`, hệ thống vẫn tự sinh mã theo `part_number + operation + số thứ tự` như hiện nay.

## Thay đổi kỹ thuật

- Thêm bảng quy đổi tên cột (chấp nhận khác hoa thường, dấu cách, BOM) trong bộ nạp CSV.
- Ghi thêm `customer`, `due_date`, `priority` vào lệnh sản xuất; `workshop` và tên máy khi tạo máy mới.
- Ghép actual theo `wo_number` (+ `operation_seq` nếu có), chỉ lùi về mã bản vẽ khi không có mã lệnh.
- Nạp `good_qty`, `ng_qty`, máy thực tế, người vận hành (tra theo `employee_code` trong hồ sơ) vào công việc.
- Nếu chưa có công việc tương ứng thì tạo mới thay vì bỏ qua dòng.
- Màn hình nạp dữ liệu: hiển thị danh sách cột được nhận diện, cột bị bỏ qua và số dòng lỗi kèm lý do; thêm nút tải file mẫu plan.csv và actual.csv.

## Ngoài phạm vi

Không đổi cấu trúc cơ sở dữ liệu ngoài việc dùng các cột đã có, không làm nạp dữ liệu tự động theo lịch.
