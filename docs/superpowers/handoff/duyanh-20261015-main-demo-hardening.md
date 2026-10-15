# TRỌƠI — FINAL IMPLEMENTATION & DEMO HANDOFF

**Người tiếp quản:** Duy Anh  
**Branch:** `main`  
**Baseline commit:** `5126d62`  
**Mục tiêu:** Hoàn thiện toàn bộ nghiệp vụ hiện có của TrọƠi, thống nhất cấu hình và hạ tầng, xử lý các luồng chưa hoạt động, tích hợp Android–Backend–Database và chuẩn bị bản demo hoàn chỉnh.

## 1. Định hướng triển khai

Giai đoạn hiện tại ưu tiên **Product Completion & Stabilization**, không tiếp tục mở rộng sản phẩm theo hướng thêm hàng loạt tính năng mới.

Tuy nhiên, điều này **không có nghĩa chỉ kiểm tra những gì đã có**.

Những chức năng đã xuất hiện trong giao diện, đã có API hoặc đã được thiết kế thành một phần của luồng nghiệp vụ phải được hoàn thiện đến mức hoạt động thực tế.

Phân biệt rõ:

- **Existing Feature:** Chức năng đã tồn tại nhưng chưa hoàn chỉnh → phải hoàn thiện.
- **Broken Feature:** Có giao diện/API nhưng lỗi hoặc không chạy → phải sửa.
- **Disconnected Feature:** Frontend có nhưng chưa kết nối Backend/Database → phải tích hợp.
- **Mock-only Feature:** Chỉ hoạt động bằng dữ liệu giả trong bộ nhớ → phải đánh giá và chuyển sang Backend thật nếu thuộc luồng demo.
- **New Feature:** Chức năng hoàn toàn mới, nằm ngoài phạm vi demo → tạm hoãn.

Không được coi việc ẩn nút, bỏ chức năng, chuyển sang Mock hoặc ghi chú "chưa hỗ trợ" là cách hoàn thành một nghiệp vụ bắt buộc.

Nếu một chức năng còn thiếu thiết kế nghiệp vụ, cần xác định phương án hợp lý, trình những quyết định có ảnh hưởng đến sản phẩm để chốt, sau đó triển khai.

**Kết quả cuối cùng phải là một ứng dụng thực sự hoạt động, không chỉ một giao diện mô phỏng.**

---

## 2. Source Code Audit & Refactoring

### 2.1. Kiểm tra toàn bộ source

Rà soát toàn bộ:

- Android Kotlin / Jetpack Compose.
- NestJS Backend.
- PostgreSQL repositories, migrations và database schema.
- API contracts, DTOs và validation.
- Authentication, Authorization.
- Payment Gateway.
- Database seeds và JSON fixtures.
- Docker và các script chạy hệ thống.

Không chỉ lập danh sách lỗi. Những vấn đề có thể xử lý an toàn trong phạm vi hiện tại phải được sửa trực tiếp.

### 2.2. Hardcoded Values

Tìm và xử lý:

- Business logic chứa giá trị cố định không hợp lý.
- Giá tiền, phí dịch vụ và thông số nghiệp vụ.
- API URLs, host, ports.
- User IDs, Organization IDs, Room IDs.
- Database credentials và secrets.
- Dữ liệu demo bị nhúng trực tiếp vào production code.
- Placeholder hoặc fallback làm sai trạng thái thực tế.
- Những đoạn logic phụ thuộc cứng vào dữ liệu của một tài khoản test.

Phân loại hardcode thành:

1. **Technical Constant:** Hằng số kỹ thuật hợp lệ, được giữ lại.
2. **Configurable Value:** Chuyển sang configuration.
3. **Business Data:** Đọc từ Backend/Database hoặc cấu hình nghiệp vụ phù hợp.
4. **Test Data:** Chuyển vào JSON fixture/seed của môi trường test.
5. **Invalid Hardcode:** Xóa hoặc thay bằng logic đúng.

Không thay tất cả hardcode một cách máy móc.

### 2.3. Naming & Code Quality

Kiểm tra và chỉnh sửa:

- Convention của Kotlin và TypeScript.
- Tên class, interface, method, variable.
- Tên DTO, repository và service.
- API endpoint naming.
- Database table/column naming.
- Sự nhất quán giữa Frontend Models và Backend DTOs.
- Dead code, duplicated code và unreachable branches.
- Exception handling và error messages.

Ưu tiên sửa code để thống nhất naming, tránh đổi tên hàng loạt làm hỏng API hoặc migration.

### 2.4. JSON Fixtures

Kiểm tra và hoàn thiện hệ thống JSON fixture.

Yêu cầu:

- Dữ liệu nghiệp vụ test phải có fixture tương ứng.
- Fixture được kiểm tra bằng JSON Schema.
- Không thiếu required fields.
- Không có ID/relationship sai.
- Không tạo fixture trùng lặp hoặc mâu thuẫn.
- Không phụ thuộc vào thứ tự chạy test.
- Không fallback sang business literals trong test code.
- Các bộ fixture Android và Backend phải nhất quán khi cùng mô phỏng một nghiệp vụ.

Các test failure về Finance, Application Restart và Identity được ghi nhận tại baseline phải được sửa đến khi PASS.

**Deliverable:** Source đã refactor, test fixture hoàn chỉnh, thống kê các hardcode còn lại cùng lý do giữ chúng.

---

## 3. Configuration Consolidation

### 3.1. Mục tiêu

Hợp nhất hệ thống configuration để có **một nguồn cấu hình private chính**, giảm tối đa việc phải chỉnh sửa nhiều file mỗi lần đổi môi trường.

Định hướng:

- `.env` — file cấu hình local chính, tuyệt đối không commit.
- `.env.example` — template công khai, không chứa credential thật.
- `docker-compose.yml` — dùng các biến được cung cấp qua `.env`.
- Backend đọc environment variables.
- Android Gradle nhận các biến phù hợp thông qua environment hoặc một cơ chế đồng bộ cấu hình được kiểm thử.

### 3.2. Việc phải triển khai

Rà soát và thống nhất cấu hình từ:

- `.env` và các file `.env.*` đang tồn tại.
- `.env.messaging.example`.
- `gradle.properties` và `gradle.properties.example`.
- `local.properties`.
- `keystore.properties`.
- Docker Compose.
- Các script demo/seed.
- Backend, Google Auth, Google Maps, SePay và MinIO.

Chỉ duy trì những file phụ thật sự bắt buộc vì yêu cầu công cụ, như Android SDK local path hoặc signing keystore.

### 3.3. Bảo mật Git

Kiểm tra các file nhạy cảm đã từng được track hay chưa.

Nếu có:

- Untrack bằng `git rm --cached`, không xóa bản local.
- Cập nhật `.gitignore` và `.dockerignore`.
- Kiểm tra staged files trước commit.
- Không đưa credentials, database dumps, bank credentials, keystore hoặc token vào Docker image.
- Xoay các secret nếu có bằng chứng chúng từng bị lộ.

**Tuyệt đối không push `.env`, `gradle.properties` cá nhân, `local.properties`, `keystore.properties`, file signing hoặc secret thật lên GitHub.**

Không được nhúng backend secret vào APK.

### 3.4. Kết quả mong muốn

Sau khi hoàn thiện, người khác chỉ cần:

1. Clone repository.
2. Tạo `.env` từ `.env.example`.
3. Điền credentials được cấp.
4. Cài Android SDK và cấu hình signing nếu cần.
5. Khởi chạy Backend/Database.
6. Build App.

Không phải tự sửa nhiều file hoặc hardcode IP/port để hệ thống chạy.

---

## 4. Docker Infrastructure — Full Stack

### 4.1. Mục tiêu

Hợp nhất Backend và các infrastructure dependencies vào **một `docker-compose.yml` làm entrypoint chính**.

Bao gồm:

| Service | Vai trò |
|---|---|
| NestJS Backend | REST API và nghiệp vụ |
| PostgreSQL + PostGIS | Database chính |
| MinIO | Object storage cho những luồng media đã triển khai |
| Redis | Cache/runtime dependency nếu thực sự có adapter sử dụng |
| Migration/Init | Tạo và cập nhật database schema |
| Storage initialization | Chuẩn bị bucket và quyền truy cập cần thiết |

MinIO/Redis có thể sử dụng Docker Compose profiles nếu chưa bắt buộc đối với tất cả môi trường.

### 4.2. Công việc triển khai

- Hợp nhất các Compose configuration đang phân tán.
- Chuẩn hóa environment variables.
- Kiểm tra Dockerfile Backend.
- Kiểm tra healthchecks.
- Kiểm tra network/service discovery.
- Chuẩn hóa container names, ports và volumes.
- Kiểm tra dependencies và startup order.
- Tự chạy migrations theo cơ chế an toàn.
- Cấu hình object storage/private buckets nếu nghiệp vụ sử dụng.
- Bổ sung logging phù hợp.
- Đảm bảo database được lưu trong persistent volume.

### 4.3. Rebuild & Verification

Không chỉ sửa Compose rồi kết thúc.

Phải thực hiện:

1. Backup và kiểm tra Docker volumes/database đang chạy.
2. Dựng môi trường kiểm thử song song, tránh ảnh hưởng container của người khác.
3. Build lại Docker image.
4. Start toàn bộ stack.
5. Chạy migrations.
6. Nạp dữ liệu development/demo.
7. Kiểm tra tất cả healthchecks.
8. Thử API từ Android.
9. Restart containers.
10. Xác minh database và media không mất dữ liệu.

Không dùng `docker compose down -v`, xóa volume hoặc reset database có dữ liệu quan trọng.

### 4.4. Kết quả

Một cấu hình Compose thống nhất, có thể dựng môi trường demo bằng lệnh rõ ràng.

Môi trường SePay có giao dịch thật phải được tách biệt hợp lý; không nới lỏng các điều kiện bảo vệ database chỉ để chạy chung Docker.

---

## 5. Hoàn thiện toàn bộ nghiệp vụ Android ↔ Backend ↔ Database

**Đây là phần trọng tâm của handoff.**

Với mỗi nghiệp vụ, Duy Anh phải kiểm tra luồng hiện tại, phát hiện phần thiếu và **triển khai hoàn chỉnh phần còn thiếu**, không dừng ở UI audit.

### 5.1. Authentication & Session Management

Hoàn thiện và kiểm thử:

- Đăng nhập bằng Google.
- Đăng ký tài khoản nếu chưa tồn tại.
- Backend xác thực Google ID Token.
- Tạo phiên đăng nhập hợp lệ.
- Refresh session.
- Logout và revoke session.
- Khôi phục trạng thái sau khi tắt/mở App.
- Tải hồ sơ và quyền truy cập của tài khoản.
- Chuyển giữa những ngữ cảnh được phép.
- Xử lý token hết hạn.
- Xử lý lỗi mạng và lỗi xác thực.

Đảm bảo Debug Mock Login không làm sai kết quả kiểm thử Auth thật.

Nếu luồng Google Login hiện lỗi, phải **sửa cho hoạt động**, không thay bằng Mock rồi coi như hoàn thành.

**Acceptance:** Đăng nhập Google thật → Backend nhận diện đúng User → load đúng dữ liệu → đóng/mở App vẫn hoạt động → logout/revoke đúng.

### 5.2. Owner — Quản lý tài sản và phòng trọ

Hoàn thiện toàn bộ vòng đời:

- Tạo Organization/workspace hợp lệ.
- Tạo tài sản/khu trọ.
- Tạo và quản lý phòng.
- Chỉnh sửa thông tin phòng.
- Cập nhật trạng thái trống/đang thuê/ngừng quản lý.
- Quản lý ảnh và thông tin tiện nghi.
- Tạo/chỉnh sửa Listing cho Discovery.
- Quản lý dữ liệu người thuê.
- Hiển thị số phòng và tình trạng vận hành.
- Xem tổng quan khoản phải thu, Payment và sự cố.

Đảm bảo tất cả thao tác được lưu vào Backend/Database, không mất khi restart ứng dụng.

Xử lý những màn hình chỉ lưu dữ liệu local hoặc chưa kết nối API.

### 5.3. Owner — Mua thêm slot quản lý phòng

**Blocker cụ thể đã phát hiện:**

- `AssetWizard.kt` có nút **“Mở thêm 1 slot”**.
- Giao diện đang hiển thị **259.000đ/năm**.
- `TroOiViewModel.purchaseLocalCapacity()` hiện trả `REAUTH_UNAVAILABLE`.
- Chưa có luồng thanh toán slot end-to-end.

Yêu cầu Duy Anh giải quyết nghiệp vụ này, không chỉ kiểm tra nút.

Trước khi implement cần chốt với Product:

- Slot được tính theo phòng/tài sản nào?
- Giá và thời hạn có đúng là 259.000đ/năm không?
- Khi mua thêm slot, capacity tăng lúc nào?
- Nếu thanh toán thất bại hoặc bị hủy thì sao?
- Gia hạn/hết hạn slot xử lý như thế nào?
- Có sử dụng SePay hay gateway riêng?

Sau khi các quyết định được duyệt, hoàn thiện:

**Owner → Hết slot → Mở thêm slot → Tạo Checkout → Thanh toán → Backend xác minh → Capacity cập nhật → Có thể thêm phòng.**

Không dùng Payment của Tenancy để đại diện sai cho thanh toán phí slot. Nếu nghiệp vụ slot chưa được phê duyệt để triển khai trong phiên bản demo, phải báo blocker và xin quyết định loại khỏi phạm vi, không âm thầm bỏ.

### 5.4. Tenant — Vòng đời thuê phòng

Hoàn thiện các nghiệp vụ đang được sản phẩm hỗ trợ:

- Xem phòng/tài sản đang thuê.
- Xem thông tin thỏa thuận và điều khoản thuê.
- Xem tiền thuê, cọc và các khoản phụ phí đã ghi nhận.
- Xem billing cycles và charges.
- Xem khoản phải thanh toán.
- Xem lịch sử Payment.
- Xem biên nhận hợp lệ.
- Tạo và theo dõi sự cố.
- Nhận thông báo/thông tin liên quan đến lượt thuê.

Dữ liệu phải gắn với Tenant/Tenancy hợp lệ.

Không cho Tenant A xem thông tin tài chính hoặc phòng thuê của Tenant B.

### 5.5. Finance & Rental Ledger

Hoàn thiện việc đồng bộ:

**Billing Cycle → Charge → Payment → Allocation/Outstanding Balance → Receipt**, theo contract nghiệp vụ hiện tại.

Kiểm tra và sửa:

- Hiển thị khoản phải thu.
- Công nợ và lịch sử khoản thu.
- Ghi nhận Payment thủ công hợp lệ.
- Payment từ Gateway.
- Trạng thái thanh toán.
- Đồng bộ dữ liệu giữa Owner và Tenant.
- Các phép tính outstanding balance.
- Xử lý Payment trùng.
- Xử lý Payment chưa xác minh.
- Phân biệt tiền đã nhận và khoản công nợ đã được phân bổ.

Không tự động kết luận một khoản phải thu đã thanh toán đầy đủ chỉ vì tồn tại Payment.

### 5.6. SePay — Thanh toán ngân hàng thật

Phần SePay đã có một giao dịch thật thành công:

- **Số tiền:** 2.000 VND.
- **Checkout:** `4a732deb-5183-426f-a125-373af0ad6158`.
- **Trạng thái:** `SUCCEEDED`.
- **Payment:** `PROVIDER_VERIFIED`.
- Callback được xử lý và không tạo Payment trùng khi replay.

Đây là kết quả của **môi trường SePay độc lập**.

Nhiệm vụ tiếp theo:

- Tích hợp luồng SePay ổn định vào Backend/Database demo thống nhất.
- Xác minh session Tenant thật và quyền truy cập.
- Tạo Checkout từ Android.
- Mở trang thanh toán/QR.
- Xử lý browser return.
- Nhận IPN.
- Đối soát SePay REST.
- Cập nhật Payment trong database.
- Cập nhật UI Tenant.
- Cập nhật Ledger của Owner.
- Xử lý các trạng thái `CREATED`, `UNKNOWN`, `SUCCEEDED` và các trường hợp thất bại/hết hạn.
- Đảm bảo idempotency.
- Đảm bảo App restart hoặc callback lặp không tạo Payment trùng.

**Lưu ý ngân hàng:**

TrọƠi hiện sử dụng **SePay Merchant cá nhân có tài khoản TPBank liên kết để nhận tiền**.

SePay là Payment Gateway trung gian. Không giả định có TPBank API Key riêng.

Hướng dẫn cấu hình Merchant ID, Secret Key, IPN Secret, ngân hàng TPBank liên kết và webhook phải được viết đầy đủ trong README.

Không yêu cầu thêm giao dịch tiền thật khi chưa cần thiết. Có thể dùng giao dịch đã được xác minh để đối chiếu regression, kết hợp các test synthetic/sandbox độc lập.

### 5.7. Discovery / Listing

Hoàn thiện:

- Danh sách phòng công khai.
- Tìm kiếm và lọc.
- Xem chi tiết Listing.
- Hình ảnh.
- Vị trí công khai/map.
- Trạng thái còn phòng.
- Tạo/chỉnh sửa tin đăng từ Owner.
- Đồng bộ thông tin thay đổi từ Room/Listing.
- Xử lý màn hình trống, lỗi tải dữ liệu hoặc ảnh thiếu.

Dữ liệu hiển thị phải đến từ Backend thật trong demo tích hợp, không dựa vào các local fixture hardcode.

### 5.8. Incidents & Messaging

Rà soát và hoàn thiện các luồng hiện có:

- Tenant gửi báo cáo sự cố.
- Owner xem và xử lý.
- Phân loại và thay đổi trạng thái.
- Lưu lịch sử xử lý.
- Gửi/đọc tin nhắn theo ngữ cảnh hợp lệ.
- Hiển thị lịch sử sau khi reload hoặc restart.

Những phần messaging/media cần MinIO hoặc cơ chế lưu trữ phải được nối với infrastructure thực tế, nếu đó là dependency của luồng demo.

---

## 6. Database — Hoàn thiện dữ liệu demo

Mục tiêu: **App mở lên có dữ liệu hợp lý, thể hiện một hệ thống đang được sử dụng thực tế**, thay vì các màn hình rỗng.

### 6.1. Synthetic Demo Dataset

Tạo tập dữ liệu giả hợp lệ cho môi trường development/demo.

Gợi ý bao gồm:

- Nhiều chủ trọ.
- Nhiều người thuê.
- Nhiều Organization/workspace.
- Một số khu trọ/tòa nhà.
- Nhiều phòng trọ/căn hộ.
- Phòng trống và phòng đang thuê.
- Listing đang hiển thị và chưa công khai.
- Lượt thuê đang hoạt động.
- Các điều khoản thuê.
- Billing cycles, tiền thuê, điện, nước và phụ phí.
- Lịch sử Payment thủ công giả lập có nhãn rõ.
- Các khoản còn nợ.
- Một số sự cố đang xử lý và đã hoàn tất.
- Thông báo.
- Conversation/messages theo quyền truy cập.

Dữ liệu cần nhất quán về quan hệ, số tiền và trạng thái.

### 6.2. Yêu cầu triển khai Seed

- Dữ liệu deterministic, chạy lại được.
- Idempotent, không tạo duplicate records.
- Có JSON fixture/schema khi phù hợp.
- Đúng database migrations và các ràng buộc quan hệ.
- Không phụ thuộc User ID cố định ở production.
- Không ghi đè dữ liệu thật.
- Không seed nhầm vào database đã có giao dịch SePay Production.
- Không tạo Payment Gateway giả mạo `PROVIDER_VERIFIED`.

### 6.3. Acceptance

Sau khi seed:

- Guest có nhiều Listing để duyệt.
- Owner có tài sản và công nợ để quản lý.
- Tenant có phòng và khoản phải thanh toán để xem.
- Có sự cố và tin nhắn để kiểm thử.
- Có lịch sử sử dụng hợp lý.
- Restart Backend hoặc database không làm mất dữ liệu.
- Chạy lại seed không tạo trùng.

Dữ liệu demo phải giúp kiểm tra nghiệp vụ, không chỉ phục vụ screenshot.

---

## 7. README.md — Hướng dẫn toàn bộ hệ thống

Viết và cập nhật README tại root để một developer mới có thể tự dựng và chạy TrọƠi.

README phải bao gồm:

### 7.1. System Overview

- Kiến trúc tổng thể.
- Repository structure.
- Android/Backend/Database.
- Các thành phần Docker.
- Payment Gateway.
- Luồng dữ liệu giữa các thành phần.

### 7.2. Development Environment

- Node.js/pnpm.
- Docker Desktop/Compose.
- JDK và Android Studio.
- Android SDK/Emulator/ADB.
- PostgreSQL/PostGIS.
- Công cụ cần thiết khác.

### 7.3. API Keys & External Services

Hướng dẫn từng bước:

**Google Cloud**
- Tạo project.
- Cấu hình OAuth consent.
- Tạo Web Client ID và Android OAuth Client.
- Đăng ký package name/SHA-1.
- Bật và kiểm thử Google Login.

**Google Maps**
- Bật SDK.
- Tạo API Key.
- Cấu hình restrictions.
- Truyền key vào Android.

**SePay**
- Đăng ký/đăng nhập Merchant cá nhân.
- Kết nối tài khoản ngân hàng TPBank.
- Bật phương thức chuyển khoản QR.
- Lấy Merchant ID và Secret Key.
- Cấu hình IPN, HTTPS URL và Secret Key riêng.
- Bật/tắt Gateway.
- Phân biệt Sandbox/Production.
- Kiểm tra trạng thái thanh toán và đối soát.

**MinIO/Redis**
- Khi nào cần bật.
- Các biến cấu hình.
- Bucket/permissions.
- Cách kiểm tra health.

### 7.4. Running the System

Viết lệnh cụ thể:

- Clone repository.
- Tạo `.env`.
- Docker build/up.
- Database migrations.
- Seed demo.
- Backend run/build.
- Android Debug build/install.
- Android Release build/signing.
- Test commands.
- Healthchecks.
- Logs.
- Restart.
- Backup/restore.

### 7.5. Troubleshooting

Giải quyết các lỗi phổ biến:

- Google Auth không hoạt động.
- Android không kết nối Backend.
- Database không kết nối.
- Port conflict.
- Docker container không healthy.
- MinIO không tải được ảnh.
- Payment chuyển khoản thành công nhưng App chưa cập nhật.
- SePay IPN lỗi.
- Gradle/SDK/configuration lỗi.

**README chỉ được đánh dấu hoàn thành sau khi các lệnh được kiểm thử trên môi trường phù hợp.**

---

## 8. Integration Testing & Final Acceptance

Duy Anh phải kiểm tra **toàn bộ hệ thống sau khi triển khai**, không chỉ test từng module độc lập.

### 8.1. Technical Gates

- TypeScript typecheck PASS.
- NestJS build PASS.
- ESLint PASS.
- Backend unit/integration tests PASS.
- JSON fixture governance PASS.
- Database migrations PASS.
- Docker build PASS.
- Docker healthchecks PASS.
- Android Debug build PASS.
- Android unit tests PASS.
- Android Release build/signing kiểm tra khi có cấu hình hợp lệ.
- Không có credentials bị track trong Git.

Các lỗi test tồn đọng từ baseline phải được xử lý, không được đơn thuần skip hoặc thay assertion để PASS.

### 8.2. End-to-End Demo Scenarios

**Scenario A — Guest**

Mở App → Xem Discovery → Tìm kiếm → Xem chi tiết phòng.

**Scenario B — Authentication**

Google Login → Backend xác minh → Load profile → Khôi phục session khi restart.

**Scenario C — Owner**

Đăng nhập → Tạo/quản lý khu trọ → Thêm phòng → Chỉnh sửa → Đăng Listing → Xem tài sản.

**Scenario D — Tenant**

Đăng nhập → Xem phòng đang thuê → Xem điều khoản → Xem công nợ → Thanh toán.

**Scenario E — Payment**

Tạo Checkout → Mở SePay → Gateway xác nhận → IPN/REST → Backend ghi Payment → Tenant và Owner cùng nhìn thấy thông tin đúng.

**Scenario F — Slot Management**

Owner hết dung lượng → yêu cầu thêm slot → xử lý theo phương án nghiệp vụ đã phê duyệt → cập nhật capacity chính xác sau khi giao dịch đủ điều kiện.

**Scenario G — Incident**

Tenant tạo sự cố → Owner tiếp nhận → Cập nhật trạng thái → Tenant theo dõi kết quả.

**Scenario H — Persistence**

Restart App/Backend/Docker → Dữ liệu và quan hệ nghiệp vụ không thay đổi bất thường.

### 8.3. Điều kiện PASS

Mỗi scenario phải chứng minh được:

1. UI hoạt động.
2. API hoạt động.
3. Backend thực thi đúng nghiệp vụ.
4. Database ghi/đọc dữ liệu chính xác.
5. Phân quyền hợp lệ.
6. Restart không làm mất dữ liệu.
7. Có test hoặc evidence đủ để tái hiện.

Không chấp nhận trường hợp UI chuyển trạng thái thành công nhưng Backend/Database chưa cập nhật.

---

## 9. Thứ tự ưu tiên thực hiện

| Giai đoạn | Công việc | Kết quả bắt buộc |
|---|---|---|
| **P0 — Source** | Audit + refactor hardcode, naming, fixtures, lỗi tồn đọng | Source sạch hơn, test governance PASS |
| **P0 — Configuration** | Hợp nhất cấu hình, bảo vệ secret, hoàn thiện loader | Chạy local không phải sửa thủ công nhiều file |
| **P0 — Infrastructure** | Một Docker Compose, rebuild, migrations, persistent DB | Full-stack Docker hoạt động ổn định |
| **P0 — Authentication** | Hoàn thiện Google login/session/authorization | Đăng nhập thật và phân quyền PASS |
| **P0 — Business Logic** | Owner, Tenant, Finance, Listing, Incident, Messaging | Các nghiệp vụ demo lưu và đọc từ Backend |
| **P0 — Payment** | SePay tích hợp với hệ thống thống nhất; giải quyết luồng mua slot | Thanh toán và cập nhật dữ liệu đúng, không giả lập |
| **P1 — Demo Data** | Seed dữ liệu synthetic hoàn chỉnh | App có dữ liệu đa vai trò |
| **P1 — Documentation** | README full setup, secrets, Google, TPBank/SePay, Android | Developer khác dựng được môi trường |
| **Final** | Integration test và demo rehearsal | Các scenario bắt buộc PASS hoặc có blocker được chấp thuận |

Các phần có thể triển khai song song, nhưng phải được kiểm tra tương thích trước khi tích hợp.

## 10. Deliverables cuối cùng

Duy Anh phải bàn giao:

- Source code đã hoàn thiện và commit vào nhánh phù hợp.
- Hệ thống configuration đã chuẩn hóa.
- Docker Compose thống nhất và image build được.
- Database migrations/seed hoạt động.
- Android kết nối được Backend thật.
- Auth và phân quyền hoạt động.
- Các nghiệp vụ Owner/Tenant/Finance/Listing/Incident/Messaging đã hoàn thiện theo phạm vi demo.
- SePay được đối soát đúng, không tạo Payment trùng.
- Nghiệp vụ thêm slot được xử lý theo quyết định Product.
- README đầy đủ, đã kiểm thử các bước cài đặt.
- Test report.
- Danh sách issue còn lại và lý do.
- Video/screenshots demo hoặc bằng chứng E2E tương đương.

## 11. Definition of Done

Công việc được coi là hoàn thành khi:

**TrọƠi có thể được dựng từ repository, cấu hình bằng quy trình thống nhất, chạy Backend và Database qua Docker, build Android, đăng nhập thật, thực hiện các nghiệp vụ chính, lưu dữ liệu thực tế vào PostgreSQL, thanh toán đúng qua SePay, hiển thị dữ liệu nhất quán và demo ổn định.**

Không cần mọi tính năng tương lai đều hoàn thành. Nhưng mọi nghiệp vụ thuộc phạm vi demo đã chốt phải **hoạt động end-to-end**, không còn ở trạng thái UI-only, Mock-only hoặc stub.

Mọi blocker còn tồn tại phải được nêu rõ và giải quyết hoặc được người phụ trách sản phẩm chấp thuận loại khỏi phạm vi demo.

**Ưu tiên cuối cùng: hoàn thiện sản phẩm hiện có, không mở rộng sản phẩm khi các luồng cốt lõi chưa ổn định.**
