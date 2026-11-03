# MetroTube

App web (PWA) xem clip YouTube gọn nhẹ, phong cách Metro UI của Windows Phone.

- **Start**: live tile "đăng ký" lật thumbnail các clip mới · tìm kiếm · kênh · tài khoản · cài đặt
- **Đăng ký**: pivot gồm *mới nhất* (feed theo thời gian, không có thuật toán) và *kênh*
- **Xem clip**: trình phát YouTube chính thức, bên dưới là pivot *thông tin · bình luận · đề xuất* (clip cùng kênh)
- Chỉ xin quyền đọc (`youtube.readonly`). Không cần build, không phụ thuộc thư viện nào.

## Chạy

```bash
python -m http.server 8080
```

Mở <http://localhost:8080>. Phải dùng `localhost`, đúng địa chỉ đã khai trong Google Cloud (`127.0.0.1` được tính là địa chỉ khác).

## Tạo Google OAuth Client ID

1. Vào [Google Cloud Console](https://console.cloud.google.com/projectcreate) và tạo project.
2. **APIs & Services → Library**: bật **YouTube Data API v3**.
3. **Google Auth Platform → Branding**: chọn External, điền tên app và email.
4. **Audience**: thêm Gmail của bạn vào Test users.
5. **Clients → Create client → Web application**. Ở Authorized JavaScript origins, thêm `http://localhost:8080`.
6. Sao chép Client ID và dán vào **cài đặt** trong app.

## Cài như app

Trong Chrome hoặc Edge, bấm biểu tượng cài đặt (⊕) trên thanh địa chỉ, hoặc mở menu và chọn *Cài đặt MetroTube*.

## Giới hạn

- Google cấp phiên đăng nhập 1 giờ. Hết phiên, app sẽ nhắc đăng nhập lại bằng một chạm.
- Hạn mức API là 10.000 đơn vị mỗi ngày. Feed được lưu đệm 15 phút, danh sách kênh lưu đệm 6 giờ.
- YouTube API không còn cung cấp "video liên quan", nên mục đề xuất hiển thị các clip khác của cùng kênh.
