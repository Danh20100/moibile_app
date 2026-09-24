# End-to-End Use Cases

Status: Current project-level business flows

Tài liệu này mô tả TrọƠi từ góc nhìn hành vi người dùng và business flow xuyên nhiều bounded context. Nó không định nghĩa API, transport, database hoặc implementation shape.

Mỗi use case trả lời bốn câu hỏi chính: ai đang làm gì, mục tiêu business là gì, module nào tham gia và module nào sở hữu phần state/lifecycle cốt lõi.

## UC-01 Authenticate an Actor

**Primary actor:** bất kỳ người dùng nào đang vào ứng dụng.

**Business goal:** xác minh và chấp nhận một identity hợp lệ mà không giả định hệ thống đã biết profile hoặc domain context đầy đủ của actor đó.

**Business-level preconditions:** actor có một identity proof từ provider được hỗ trợ và proof đó có thể được xác minh qua integration boundary.

**Main flow:**

1. Identity proof được xác minh ở integration boundary.
2. Kết quả identity đã chuẩn hóa được đưa vào `identity-access`.
3. Identity hợp lệ được chấp nhận ở mức authentication.
4. Actor có thể đi tiếp vào hệ thống trong phạm vi những gì hiện tại đã biết và được phép.
5. Profile, organization membership, role, property access, room relationship hoặc subscription context chỉ được enrich khi nguồn dữ liệu có thẩm quyền tồn tại.

**Alternate / intentionally unresolved conditions:**

- Identity có thể hợp lệ nhưng chưa liên kết với user nội bộ đầy đủ.
- Actor có thể authenticated nhưng chưa có organization, property hoặc tenancy context.
- Cách session hoặc token nội bộ được duy trì không thuộc use case business này.

**Participating modules:** external identity integration và `identity-access`.

**Primary owner:** `identity-access` sở hữu authentication/access meaning sau khi provider verification đã được normalize.

**Boundary:** authentication thành công không được yêu cầu fabricated profile data. Integration không sở hữu role, permission hoặc domain data; `identity-access` cũng không sở hữu profile presentation, room, tenancy hoặc subscription state.

## UC-02 Set Up a Rental Operation

**Primary actor:** landlord hoặc operator.

**Business goal:** tạo cấu trúc vận hành tối thiểu để một chủ trọ có thể bắt đầu quản lý tài sản thật trong TrọƠi.

**Business-level preconditions:** actor đã được authenticated và có quyền phù hợp để tạo hoặc thao tác trong operating scope tương ứng.

**Main flow:**

1. Actor hoạt động trong một organization scope hoặc thiết lập organization scope mới khi business flow cho phép.
2. Property được tạo hoặc nhập vào organization phù hợp.
3. Room được tạo hoặc import dưới property tương ứng.
4. Room profile và trạng thái cần thiết được chuẩn bị để room có thể tham gia các workflow thuê trọ.
5. Nếu dùng bulk setup, onboarding điều phối parse, validation, preview và confirmation trước khi tạo domain data.

**Alternate / intentionally unresolved conditions:**

- Setup có thể được thực hiện thủ công hoặc qua template/CSV/Excel.
- Một actor có thể vừa là payer vừa là operator, nhưng role business không vì thế bị gộp.
- Onboarding không được bỏ qua confirmation khi flow import yêu cầu bước xác nhận.

**Participating modules:** `identity-access`, `organization`, `property`, `room`, và `onboarding` khi có bulk setup.

**Primary owner:** distributed ownership. Organization, property và room tự sở hữu resource/lifecycle của mình; onboarding chỉ điều phối quá trình nhập ban đầu.

**Boundary:** không có một “setup module” nào được sở hữu lâu dài property, room hoặc tenancy data sau khi destination module đã chấp nhận dữ liệu.

## UC-03 Start a Tenancy

**Primary actor:** landlord hoặc operator.

**Secondary actor:** tenant.

**Business goal:** tạo một quan hệ thuê có thời gian giữa một room và tenant context để các workflow vận hành sau thuê có nền tảng đúng.

**Business-level preconditions:** room reference hợp lệ, tenant identity context cần thiết tồn tại và actor thực hiện action có quyền phù hợp.

**Main flow:**

1. Actor chọn room hợp lệ và tenant context phù hợp.
2. Các điều khoản nền cần cho vận hành được ghi nhận, bao gồm thời gian thuê, giá thuê, tiền cọc và recurring-fee baseline khi áp dụng.
3. Tenancy được tạo theo lifecycle của `tenancy`.
4. Tenancy được kích hoạt khi business condition cho phép.
5. Các module khác có thể sử dụng tenancy context làm nguồn tham chiếu cho billing, receipt hoặc incident access decision.

**Alternate / intentionally unresolved conditions:**

- Tenant profile presentation có thể chưa đầy đủ nếu identity reference hợp lệ đã tồn tại.
- Cách mời tenant vào app có thể phát triển theo phase mà không thay đổi ownership của tenancy.
- Billing cycle chưa cần tồn tại ngay tại thời điểm tenancy vừa được tạo nếu business flow chưa đến kỳ thu.

**Participating modules:** `room`, `identity-access`, `tenancy`, và `audit-trust` cho business fact quan trọng.

**Primary owner:** `tenancy`.

**Boundary:** room không được hấp thụ tenancy lifecycle, tenant profile, billing state hoặc receipt history. Identity-access cung cấp identity/access context nhưng không sở hữu rental relationship.

## UC-04 Track a Monthly Receivable and Payment Record

**Primary actor:** landlord hoặc operator.

**Secondary actor:** tenant khi việc xem hoặc xác nhận bản ghi thanh toán nằm trong flow.

**Business goal:** biết một kỳ thuê đang phải thu bao nhiêu, đã ghi nhận thanh toán bao nhiêu và còn outstanding bao nhiêu.

**Business-level preconditions:** tenancy context hợp lệ tồn tại và có đủ điều khoản nền để xác định các khoản phải thu cần theo dõi.

**Main flow:**

1. `tenancy` cung cấp rental-term context cần thiết cho kỳ thu.
2. `billing` tạo hoặc duy trì billing cycle của kỳ tương ứng.
3. Rent, utilities hoặc fee hợp lệ được ghi nhận thành charge của cycle.
4. Một payment record hoặc receipt được ghi nhận qua `receipt` khi có thông tin thanh toán cần đối chiếu.
5. `receipt` cung cấp payment/confirmation outcome cần thiết cho `billing`.
6. `billing` cập nhật amount paid, outstanding balance và billing state dựa trên outcome có thẩm quyền.
7. Tenant có thể xem hoặc xác nhận receipt khi business flow và access context cho phép.

**Alternate / intentionally unresolved conditions:**

- MVP không giả định có payment gateway hoặc bank settlement tự động.
- Receipt có thể là bản ghi vận hành do người dùng xác nhận, không phải chứng từ pháp lý do TrọƠi bảo đảm.
- Cách reminder được gửi là side effect, không phải core receivable lifecycle.

**Participating modules:** `tenancy`, `billing`, `receipt`, `identity-access` khi cần authorization, và `audit-trust` cho business fact quan trọng.

**Primary owner:** `billing` sở hữu receivable state; `receipt` sở hữu operational payment/receipt record.

**Boundary:** `receipt` không được tính lại toàn bộ debt model. `billing` không được lấy ownership của receipt history. Room state không được dùng thay billing state.

## UC-05 Report and Resolve an Incident

**Primary actor:** tenant hoặc operator báo một vấn đề.

**Responding actor:** landlord hoặc operator xử lý vấn đề.

**Business goal:** ghi nhận một sự cố gắn với room và theo dõi quá trình xử lý đến khi resolved/closed.

**Business-level preconditions:** actor có quyền report trong room context phù hợp và room reference hợp lệ.

**Main flow:**

1. Actor báo một incident cho room liên quan.
2. Nếu quyền report phụ thuộc rental relationship, tenancy context được dùng để hỗ trợ access decision.
3. `incident` tạo sự cố và giữ lifecycle riêng.
4. Người xử lý acknowledge incident và đưa nó vào processing.
5. Incident có thể yêu cầu thêm thông tin rồi quay lại processing.
6. Incident được resolved và sau đó closed theo transition hợp lệ.
7. Business fact quan trọng được đưa sang audit và có thể kích hoạt notification side effect.
8. Actor liên quan có thể nhận update phù hợp mà incident không cần biết full profile hoặc device metadata của họ.

**Alternate / intentionally unresolved conditions:**

- Trong MVP, chủ trọ có thể tự xử lý hoặc sử dụng đối tác riêng ngoài nền tảng.
- Partner matching chính thức chưa phải requirement của incident MVP.
- Attachment có thể tồn tại nhưng storage implementation không thuộc use case này.

**Participating modules:** `identity-access`, `room`, `tenancy` khi cần rental context, `incident`, `audit-trust`, và notification boundary khi được đưa vào hệ thống.

**Primary owner:** `incident`.

**Boundary:** incident chỉ cần actor/room references và decisions cần thiết; nó không sở hữu profile, room lifecycle, tenancy lifecycle, notification delivery hay service marketplace.

## UC-06 View an Operational Dashboard

**Primary actor:** landlord hoặc operator.

**Business goal:** nhìn nhanh tình trạng vận hành hiện tại mà không phải mở từng module riêng lẻ.

**Business-level preconditions:** actor đã authenticated và có quyền xem operating scope tương ứng.

**Main flow:**

1. Dashboard lấy số liệu về room đang hoạt động hoặc trạng thái room cần hiển thị.
2. Dashboard lấy receivable/outstanding context từ billing.
3. Dashboard lấy unresolved incident context từ incident.
4. Khi cần, receipt reconciliation context có thể được dùng để giải thích các khoản đang chờ đối chiếu.
5. Kết quả được tổng hợp thành một read view phục vụ quyết định vận hành.

**Alternate / intentionally unresolved conditions:**

- Chỉ số nâng cao chưa phải requirement mặc định của MVP.
- Dashboard có thể thay đổi cách trình bày mà không làm thay đổi source-domain ownership.

**Participating modules:** `room`, `billing`, `incident`, `receipt` khi cần reconciliation context, cùng access context phù hợp.

**Primary owner:** distributed read-model ownership; dashboard không trở thành owner của source states.

**Boundary:** aggregation không được đồng bộ hóa hoặc ghi đè state của room, billing, receipt hoặc incident. Read model chỉ trình bày dữ liệu được phép đọc.

## UC-07 Tenant Operational Interaction

**Primary actor:** tenant.

**Business goal:** cho phép người thuê tham gia các tương tác cần thiết của kỳ thuê mà không biến tenant layer thành hệ thống quản trị thứ hai.

**Business-level preconditions:** tenant đã đi qua identity path hợp lệ và có rental context cho phép truy cập dữ liệu tương ứng.

**Main flow:**

1. Tenant được xác thực qua `identity-access`.
2. Hệ thống xác định tenancy/room context mà tenant được phép truy cập.
3. Tenant xem thông tin thuê hoặc room context được phép.
4. Tenant xem receipt/payment record liên quan.
5. Tenant xác nhận thông tin khi receipt flow yêu cầu.
6. Tenant report incident khi có sự cố.
7. Tenant xem lịch sử hoặc trạng thái xử lý trong phạm vi được phép.

**Alternate / intentionally unresolved conditions:**

- Tenant có thể được mời vào sau khi chủ trọ đã onboarding và có dữ liệu thật.
- Tenant không cần có toàn bộ capability của payer/operator.
- Public review/rating không phải mặc định của tenant flow trong MVP.

**Participating modules:** `identity-access`, `tenancy`, `room`, `receipt`, `incident`, và `audit-trust` khi history được expose có kiểm soát.

**Primary owner:** distributed ownership theo capability; không tồn tại một tenant module sở hữu các domain states này.

**Boundary:** tenant surface tiêu thụ public capabilities của các module nhưng không được tự chỉnh room, tenancy, billing, receipt hoặc incident state ngoài flow mà module owner cho phép.

## UC-08 Publish or Discover a Room

**Primary actor:** landlord/operator khi publish; prospective tenant khi discovery.

**Business goal:** cung cấp bề mặt tìm và xem phòng khi product cần mà không đổi định vị TrọƠi thành search-first marketplace.

**Business-level preconditions:** room/property context hợp lệ tồn tại và public data cần thiết đã được xác nhận để publish.

**Main flow:**

1. `listing` nhận room reference và property/location context cần thiết.
2. Public listing content được tạo hoặc duy trì độc lập với room operational history.
3. Listing đi qua publish lifecycle hợp lệ.
4. Discovery/search/map có thể hiển thị listing đã được publish.
5. Khi room/rental context thay đổi, listing chỉ cập nhật theo business rule của chính listing thay vì tự suy luận từ internal state của room hoặc tenancy.

**Alternate / intentionally unresolved conditions:**

- Discovery/filtering sophistication có thể phát triển sau.
- Map provider hoặc search index không phải core business owner.
- Một room có thể tồn tại hoàn toàn trong operational system mà không cần public listing.

**Participating modules:** `property`, `room`, `listing`, và `audit-trust` khi publish history cần được lưu vết.

**Primary owner:** `listing` sở hữu public content và publish lifecycle.

**Boundary:** listing là public projection, không sở hữu room operational history, tenancy, billing, receipt hoặc incident state. Listing/discovery/map vẫn là supporting surface của TrọƠi.

## UC-09 Future Controlled Service Partner Connection

**Primary actor:** operator và verified service partner ở phase sau.

**Business goal:** dùng dữ liệu nhu cầu vận hành thật để kết nối một sự cố phù hợp với đối tác dịch vụ đã được kiểm soát chất lượng.

**Business-level preconditions:** đây **không phải MVP core flow**. TrọƠi chỉ nên kích hoạt capability này sau khi có đủ incident data thật, partner verification và quy trình vận hành cần thiết.

**Main flow:**

1. MVP tích lũy incident demand, loại sự cố và lịch sử xử lý.
2. Ở Phase 2, partner discovery có thể giới hạn trong một khu vực và tập verified partners.
3. Operator có thể kết nối incident demand với partner phù hợp thông qua controlled flow.
4. Các phase sau mới có thể bổ sung báo giá, xác nhận hoàn thành, feedback và quality-control mechanism.

**Alternate / intentionally unresolved conditions:**

- Pricing, warranty, cancellation, dispute handling và take-rate chưa được coi là behavior đã chốt cho MVP.
- Marketplace mở cho bất kỳ technician nào tự đăng ký là ngoài scope hiện tại.

**Participating modules:** `incident` là nguồn operational demand; các partner/service bounded context tương lai chỉ được thêm khi scope riêng được phê duyệt; `audit-trust` có thể lưu business fact cần thiết.

**Primary owner:** chưa có bounded context partner chính thức trong MVP; ownership của future partner flow phải được thiết kế riêng trước implementation.

**Boundary:** không được mở rộng `incident` thành marketplace trá hình. Incident tiếp tục sở hữu incident lifecycle; future service layer chỉ tiêu thụ demand/reference cần thiết qua boundary có kiểm soát.
