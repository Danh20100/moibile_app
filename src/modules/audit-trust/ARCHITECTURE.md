# Audit & Trust Architecture

Status: Draft

## 1. Purpose

`audit-trust` là cross-cutting module chịu trách nhiệm lưu vết business fact quan trọng và tiếp nhận internal report phục vụ tra cứu, đối chiếu và platform review.

Module này giúp hệ thống biết ai đã làm gì, với resource nào và vào thời điểm nào mà không chiếm ownership của business logic gốc.

## 2. Architectural Principle

Module tuân theo **Contract-first + persistence-agnostic business flows**.

Audit phải ghi nhận business fact từ bounded context có thẩm quyền thay vì tự suy luận lại business rule của module phát sinh sự kiện.

Persistence là nơi lưu history; database không quyết định business truth hoặc ai đúng/sai.

## 3. Knowledge Boundary

Audit chỉ cần actor/action/resource/timestamp metadata và các dữ liệu bổ sung thực sự cần cho việc tra cứu hoặc đối chiếu.

Internal report chỉ cần thông tin cần thiết để platform review tiếp nhận và theo dõi.

Module không cần biết toàn bộ internal state của tenancy, billing, receipt, incident, onboarding hoặc room để ghi audit fact.

Audit-trust không tự kết luận tranh chấp, động cơ hoặc tính đúng/sai của actor chỉ từ event history.

## 4. Business Flows

Các business flow chính gồm:

- nhận một business fact cần audit từ module khác;
- lưu event theo actor, action, resource và thời điểm;
- cung cấp history lookup cho resource hoặc flow được phép;
- tiếp nhận internal report;
- đưa internal report vào platform-review flow ở mức cần thiết;
- trả kết quả/classification khi platform process đã đưa ra outcome.

Audit flow và internal-report flow là hai capability liên quan nhưng không được trộn với business lifecycle của resource gốc.

## 5. State & Invariants

README chưa chốt state machine chi tiết cho audit event hoặc internal report, vì vậy architecture không tự thêm state mới.

Các invariant chính:

- audit fact phải phản ánh business fact đã xảy ra từ nguồn có thẩm quyền;
- audit history quan trọng không được âm thầm biến mất hoặc bị viết lại như chưa từng tồn tại;
- audit-trust không được sửa business state của resource gốc;
- internal report không đồng nghĩa với public rating;
- internal report không phải phán quyết tranh chấp hoặc legal guarantee;
- audit metadata không được dùng để tự suy luận business rule thuộc ownership của module khác.

## 6. Public Boundary

Các module khác chỉ được tương tác với audit-trust thông qua capability công khai như:

- gửi business fact cần lưu vết;
- tra cứu audit history được phép;
- gửi internal report;
- đọc trạng thái hoặc outcome của internal report khi được phép.

Bên ngoài không được dùng audit-trust như đường tắt để chỉnh sửa resource gốc hoặc bỏ qua public boundary của bounded context đó.

## 7. Cross-module Relationships

Audit-trust có thể nhận business fact từ nhiều module, bao gồm:

- `identity-access`;
- `tenancy`;
- `billing`;
- `receipt`;
- `incident`;
- `onboarding`;
- `room`;
- các module khác khi business fact thực sự cần lưu vết.

Quan hệ này là one-way về ownership: module gốc sở hữu business action; audit-trust sở hữu audit record của action đó.

## 8. Ownership

`audit-trust` sở hữu:

- audit event/history;
- actor/action/resource/timestamp metadata phục vụ lưu vết;
- history lookup capability;
- internal report record;
- platform-review context và outcome ở mức internal report khi được chốt.

`audit-trust` không sở hữu:

- business lifecycle của resource được audit;
- public review/rating;
- legal adjudication;
- cưỡng chế ngoài đời thực;
- authentication;
- room, tenancy, billing, receipt hoặc incident state.

## 9. Persistence Boundary

Audit-trust business behavior không phụ thuộc database engine hoặc schema cụ thể.

Persistence chỉ lưu và phục hồi audit history, internal report context và outcome cần thiết.

Storage design phải phục vụ khả năng truy vết nhưng không được biến database constraint thành nơi định nghĩa business rule của module nguồn.

## 10. Events & Side Effects

Audit-trust chủ yếu là consumer của business fact từ module khác và có thể phát sinh business fact riêng khi:

- audit event được ghi nhận;
- internal report được tạo;
- internal report được cập nhật theo platform-review flow;
- internal report có outcome/classification.

Notification, analytics hoặc operational follow-up sau internal report là side effect ngoài core audit/history responsibility nếu không được scope riêng.

## 11. Error & Testing View

Business errors tập trung vào domain audit/trust, ví dụ:

- audit input không đủ context cần thiết;
- resource reference không hợp lệ cho lookup;
- internal report không hợp lệ;
- actor không có quyền xem history hoặc report outcome.

Testing tập trung vào behavior:

- business fact từ module nguồn được lưu mà không làm thay đổi resource gốc;
- history lookup trả đúng phạm vi được phép;
- internal report không biến thành public rating;
- audit-trust không tự kết luận ai đúng/sai từ event history;
- thay persistence mechanism không làm thay đổi behavior contract.

## 12. Evolution

Giai đoạn đầu tập trung vào audit event và history lookup cho các action quan trọng.

Giai đoạn tiếp theo bổ sung internal report và platform-review flow tối thiểu.

Sau đó có thể enrich classification, operational tooling hoặc analytics khi business scope rõ hơn.

Mọi mở rộng phải giữ audit-trust là trust/history layer, không biến nó thành nơi sở hữu hoặc tái triển khai business logic của các bounded context khác.
