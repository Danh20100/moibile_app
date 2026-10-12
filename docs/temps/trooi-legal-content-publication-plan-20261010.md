# TrọƠi — Tài liệu Pháp lý: Nội dung, lưu trữ và phát hành

> **Trạng thái:** DỰ THẢO / CHƯA PHÊ DUYỆT PHÁP LÝ. Đây là ghi chú kỹ thuật + văn bản mẫu để dùng UI trong giai đoạn phát triển; không xác nhận TrọƠi đã chính thức công bố điều khoản hoặc chính sách. Không tự thay đổi canonical, backend hoặc database.

## 1. Nội dung đã chuẩn bị

| Loại | Bản tiếng Việt offline trong app | Trạng thái |
|---|---|---|
| Điều khoản sử dụng | `app/src/main/assets/legal/terms-of-use.vi.md` | `draft/0.1`, 10/10/2026 |
| Chính sách quyền riêng tư | `app/src/main/assets/legal/privacy-policy.vi.md` | `draft/0.1`, 10/10/2026 |

`app/src/main/java/com/trooi/app/features/profile/LegalDocuments.kt` đọc các file từ Android assets (UTF-8, subset Markdown), không cần API, có thể xem khi offline. Mục Pháp lý mở hai màn nội dung đầy đủ qua `AccountSettingsFlow`. Source document nằm trong assets nên bản phát hành APK luôn có snapshot bất biến tương ứng phiên bản app; không phải một API động.

**Các nội dung chưa xác nhận:** tên/địa chỉ/email pháp nhân chịu trách nhiệm, mục đích và thời hạn lưu giữ từng loại dữ liệu cụ thể, danh sách nhà cung cấp xử lý dữ liệu thực, vùng lưu trữ, quy trình xử lý yêu cầu chủ thể dữ liệu, giá/phí, thủ tục pháp lý và ngày điều khoản có hiệu lực. Không điền thông tin giả để tạo ấn tượng đã phê duyệt.

## 2. Các hệ thống thường lưu văn bản pháp lý ở đâu?

1. **Tập tin được quản lý phiên bản trong Git/CMS:** Markdown, HTML hoặc text làm bản nguồn có audit trail và review. Người soạn + kiểm tra pháp lý + người phê duyệt đều xác nhận.
2. **Website tĩnh / Object Storage + CDN:** xuất bản bản HTML/PDF ở URL bất biến theo phiên bản, ví dụ `/legal/vi/terms/v1.0.html` và `/legal/vi/privacy/v1.0.html`; có URL `/legal/vi/terms/current` do backend/CMS resolve tới bản hiện hành. Giữ các bản cũ để đối chiếu.
3. **Ứng dụng mobile:** có thể mở WebView/browser từ canonical URL hoặc cache/bundle snapshot để đọc offline. TrọƠi hiện chọn assets offline để không tạo phụ thuộc backend chỉ để trình bày.
4. **Database:** thường chỉ cần khi phải quản lý metadata phát hành, hiệu lực, mapping phiên bản, hoặc **bằng chứng user đã chấp thuận**. Không nhất thiết nhét toàn bộ văn bản HTML vào bảng SQL.

## 3. Metadata và ghi nhận chấp thuận khi sản phẩm chính thức vận hành

Đề xuất khái niệm (chưa tạo schema hay API):
- `legal_documents`: `document_id`, `slug` (terms/privacy), `locale`, `version`, `sha256`, `immutable_url`, `published_at`, `effective_at`, `status`.
- `terms_acceptances`: `user_id`, `document_id`, `accepted_at`, `channel`/application source. Bằng chứng có thể cần session/device metadata phù hợp giới hạn bảo vệ dữ liệu, không lưu nhiều hơn mức cần thiết.
- **Consent choices** cho marketing, chia sẻ/tùy chọn dữ liệu là một loại ghi nhận **khác với việc đọc chính sách hoặc chấp nhận điều khoản**, cần mục đích, phiên bản văn bản đồng ý và thời điểm thu hồi tương ứng khi pháp luật đòi hỏi.
- `privacy-policy viewed` không đồng nghĩa `consent`; **không tự động ghi nhận đồng ý** chỉ bằng cách user mở trang Pháp lý.
- Khi điều khoản thay đổi trọng yếu, backend có thể yêu cầu xem và chấp thuận phiên bản mới trước hành động thích hợp, nhưng không tự bật các chính sách vô hiệu hóa dữ liệu/role.

Nếu chưa có backend cần thiết: **0 bảng database bổ sung** cho việc đọc nội dung. Khi có bản chính thức, CTO/backend owner chọn vị trí lưu và contract, không để mobile tự thêm migrations.

## 4. Checklist cần làm trước khi công bố chính thức

- [ ] Phê duyệt nội dung từ người chịu trách nhiệm và chuyên gia pháp lý phù hợp.
- [ ] Điền tên tổ chức/chủ thể vận hành, liên hệ pháp lý, email quyền dữ liệu cá nhân và địa chỉ.
- [ ] Phân loại vai trò xử lý dữ liệu, nguồn và phạm vi thông tin thực tế; không nói “chúng tôi mã hóa/lưu trữ/không chia sẻ” nếu chưa có bằng chứng kỹ thuật.
- [ ] Xác định thời hạn lưu trữ và xóa của tài khoản, phiếu sự cố, lịch sử thuê, payment/receipt và log; đối chiếu thời hạn pháp luật.
- [ ] Xác minh nhà cung cấp authentication/payment/storage/analytics và tình trạng chuyển dữ liệu ngoài Việt Nam nếu có.
- [ ] Xác nhận quyền và kênh yêu cầu dữ liệu; quy trình rút lại đồng ý phù hợp.
- [ ] Gắn phiên bản, hash, trạng thái phát hành, ngày hiệu lực; bảo đảm vẫn đọc được bản trước đó.
- [ ] Xác định khi nào phải yêu cầu chấp thuận điều khoản và cách backend ghi nhận đúng phiên bản.
- [ ] Review nội dung tương thích với Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15, Nghị định 356/2025/NĐ-CP (đều có hiệu lực từ 01/01/2026), cùng văn bản hiện hành khác có liên quan tại thời điểm công bố.
- [ ] Đổi nhãn `Bản dự thảo` sang văn bản hiệu lực chỉ sau khi tất cả bước trên được thông qua.

## 5. Nguồn pháp luật tham khảo

- Cổng văn bản Chính phủ, Luật 91/2025/QH15: https://vanban.chinhphu.vn/?docid=214590&pageid=27160
- Cơ sở dữ liệu quốc gia VBPL, Nghị định 356/2025/NĐ-CP: https://vbpl.vn/bocongan/Pages/vbpq-toanvan.aspx?ItemID=187276

**Không phải ý kiến tư vấn pháp lý riêng cho TrọƠi.**
