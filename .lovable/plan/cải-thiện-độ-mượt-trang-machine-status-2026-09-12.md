# Cải thiện độ mượt trang Machine Status

## Mục tiêu
Giữ toàn bộ danh sách máy và lịch sử trạng thái trong khung làm việc hiện tại, giúp tìm máy và cập nhật trạng thái nhanh dù số lượng máy tiếp tục tăng.

## Thay đổi giao diện
- Thêm thanh điều khiển cố định gồm tổng số máy, thống kê theo trạng thái, ô tìm kiếm theo mã/tên/xưởng và bộ lọc trạng thái.
- Chuyển danh sách máy sang lưới thẻ nhỏ gọn, tự đổi số cột theo chiều rộng màn hình.
- Mỗi thẻ ưu tiên mã máy, tên máy, xưởng và trạng thái; màu viền trái giúp quét trạng thái nhanh.
- Giữ ghi chú và đổi trạng thái nhưng bố trí gọn; phần sửa tên/xưởng của quản lý mở theo từng máy, không làm các thẻ khác đổi chiều cao.
- Chia trang thành hai vùng: danh sách máy cuộn độc lập phía trên và lịch sử trạng thái cố định phía dưới, để bảng lịch sử luôn truy cập được.
- Trên màn hình hẹp, thanh điều khiển tự xuống dòng an toàn và hai vùng vẫn cuộn trong khung, không tràn ngang.

## Hành vi
- Tìm kiếm và lọc thực hiện ngay trên dữ liệu đã tải, không gọi thêm dữ liệu mỗi lần nhập.
- Hiển thị số máy đang thấy sau khi lọc và trạng thái rỗng rõ ràng khi không có kết quả.
- Khi đổi trạng thái hoặc lưu thông tin máy, chỉ khóa thao tác của đúng máy đang xử lý và giữ nguyên vị trí cuộn.
- Giữ nguyên quyền ADMIN/LEADER/OPERATOR, dữ liệu, audit log và chu kỳ tự làm mới hiện tại.

## Kiểm tra
- Kiểm tra với toàn bộ khoảng 90 máy hiện có ở kích thước desktop đã chọn và một màn hình hẹp.
- Xác nhận không còn cuộn toàn trang dài, không tràn ngang, lịch sử vẫn thấy được, tìm kiếm/lọc hoạt động và các thao tác sửa/đổi trạng thái không gây nhảy bố cục.
- Kiểm tra lỗi hiển thị, lỗi chạy và trạng thái build sau khi hoàn tất.

## Chi tiết kỹ thuật
- Phạm vi chính: trang `/machines`; chỉ bổ sung token/chỉ dẫn trình bày dùng chung nếu thật sự cần.
- Dùng vùng `min-h-0` + `overflow-auto` trong bố cục flex cố định theo chiều cao còn lại của ứng dụng.
- Dùng grid responsive với `minmax(0, 1fr)` cho vùng chữ và kích thước ổn định cho nút/trạng thái.
- Không thay đổi cấu trúc cơ sở dữ liệu hoặc quy tắc import CSV.
