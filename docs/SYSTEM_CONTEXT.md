# System Context

Status: Current project-level bounded-context map

Tài liệu này nối ba lớp hiểu biết của backend TrọƠi: product intent, end-to-end use case và module ownership. Nó không thay thế `ARCHITECTURE.md` của từng module.

## 1. System Mental Model

Mental model chính của TrọƠi bắt đầu từ phạm vi vận hành và đi dần xuống các lifecycle cụ thể:

**Organization → Property → Room → Tenancy → Billing → Receipt**

Chuỗi này không có nghĩa module phía trước sở hữu internal state của module phía sau. Nó chỉ mô tả đường đi phổ biến của business context.

Các bounded context khác bổ sung capability xung quanh chuỗi trên:

- `identity-access` cung cấp identity context, role/scope khi đã tồn tại và access decision; nó không sở hữu room, tenancy hoặc billing data.
- `incident` sở hữu lifecycle sự cố và tham chiếu `room`; khi quyền report phụ thuộc rental relationship, nó có thể dùng tenancy context thông qua public boundary.
- `listing` là public projection của selected room/property context phục vụ discovery và map; nó không sở hữu post-rental operational history.
- `onboarding` điều phối nhập dữ liệu ban đầu qua validation, preview và confirmation; sau khi domain data được tạo, ownership thuộc destination module.
- `subscription` quyết định product entitlement ở organization level; entitlement không thay thế identity permission hoặc business rule của feature module.
- `audit-trust` ghi nhận business fact và history; nó không tái triển khai business lifecycle của source module.

## 2. Current Bounded Contexts

### `identity-access`

Sở hữu identity/access boundary, invitation, role/scope khi context đã tồn tại và permission decision. Authentication có thể thành công trước khi profile hoặc domain enrichment tồn tại.

### `organization`

Sở hữu business operating scope cấp cao nhất và grouping ở mức organization.

### `property`

Sở hữu property profile, location nền và relationship giữa property với organization/room references ở mức business.

### `room`

Sở hữu room identity, profile, room lifecycle và quan hệ với property. Room là operational anchor nhưng không phải aggregate chứa mọi workflow khác.

### `tenancy`

Sở hữu rental relationship theo thời gian giữa room và tenant context, cùng terms và tenancy lifecycle.

### `billing`

Sở hữu billing cycle, charge composition, receivable state, outstanding balance và billing lifecycle theo kỳ thuê.

### `receipt`

Sở hữu operational payment/receipt record, confirmation/history và outcome phục vụ reconciliation.

### `incident`

Sở hữu incident state, lifecycle, transition rule và timeline xử lý sự cố.

### `listing`

Sở hữu public listing content và publish lifecycle. Listing không phải room operational record.

### `onboarding`

Sở hữu flow nhập dữ liệu ban đầu, validation, preview, confirmation và mapping orchestration; không sở hữu lâu dài domain data đã tạo.

### `subscription`

Sở hữu organization-level subscription context, entitlement/capability decision và usage/limit metadata khi được chốt.

### `audit-trust`

Sở hữu audit history và internal report/trust context; không sở hữu lifecycle của resource được audit.

## 3. Use-Case-to-Module Ownership Matrix

| Use case | Primary owner | Collaborators | Primary interaction style |
|---|---|---|---|
| UC-01 Authenticate an Actor | `identity-access` | external identity integration | normalized decision + identity reference |
| UC-02 Set Up a Rental Operation | distributed: `organization`, `property`, `room` | `identity-access`, `onboarding`, `audit-trust` | references + creation decisions + events |
| UC-03 Start a Tenancy | `tenancy` | `room`, `identity-access`, `audit-trust` | references + access decision + events |
| UC-04 Track a Monthly Receivable and Payment Record | `billing` for receivable; `receipt` for payment record | `tenancy`, `identity-access`, `audit-trust` | references + payment outcome decision + events |
| UC-05 Report and Resolve an Incident | `incident` | `identity-access`, `room`, `tenancy`, `audit-trust`, notification boundary | references + access decision + events |
| UC-06 View an Operational Dashboard | distributed read model | `room`, `billing`, `receipt`, `incident`, access context | read-model aggregation |
| UC-07 Tenant Operational Interaction | distributed by capability | `identity-access`, `tenancy`, `room`, `receipt`, `incident`, `audit-trust` | references + decisions + bounded reads/actions |
| UC-08 Publish or Discover a Room | `listing` | `room`, `property`, `audit-trust` | references + public projection + events |
| UC-09 Future Controlled Service Partner Connection | not yet defined for MVP | `incident`, future partner/service context, `audit-trust` | future references + controlled decisions/events |

Primary owner trong bảng nghĩa là bounded context sở hữu lifecycle/state cốt lõi của phần business đó. Collaborator chỉ cung cấp reference, decision, event hoặc read data cần thiết; collaborator không tự động trở thành co-owner của state.

## 4. Cross-Module Collaboration Rules

### 4.1 Public knowledge only

Một module chỉ được biết module khác thông qua public reference, public decision, event hoặc read capability đã được cho phép.

Không module nào được lấy internal representation của module khác rồi tự dựng lại business rule hoặc tự quyết định state transition thay cho owner.

### 4.2 Reference does not transfer ownership

Room reference xuất hiện trong tenancy, billing, incident hoặc listing không làm các module đó sở hữu room lifecycle.

Tương tự, tenant reference xuất hiện trong tenancy không làm tenancy sở hữu identity/profile.

### 4.3 Decision remains with the authority that owns the rule

Nếu incident cần biết actor có quyền report hay không, incident tiêu thụ access decision thay vì tự suy luận permission từ user data.

Nếu một feature cần entitlement, feature tiêu thụ decision từ subscription nhưng vẫn tự sở hữu business rule của feature đó.

### 4.4 Events describe facts, not remote mutation

Khi tenancy, billing, receipt, incident hoặc listing phát sinh một business fact quan trọng, audit, notification hoặc analytics có thể phản ứng với event đó.

Consumer không được dùng event như lý do để lấy ownership hoặc sửa trực tiếp source lifecycle.

### 4.5 Read-model aggregation does not create ownership

Dashboard có thể tổng hợp room, billing, receipt và incident data để trình bày một operational view. Aggregation này không biến dashboard thành source of truth cho các state đó.

Map/search có thể trình bày listing/location context. Điều này không biến map/search thành owner của room, property hoặc listing lifecycle.

## 5. State Independence

Các state sau phải được xem là độc lập dù chúng có liên quan trong cùng một user journey:

- organization state;
- property state;
- room state;
- tenancy state;
- billing state;
- receipt confirmation/history state;
- incident state;
- listing publish state;
- subscription state/entitlement context;
- onboarding/import progress khi tồn tại.

Một thay đổi ở state A không tự động có nghĩa state B phải đổi, trừ khi owner của B nhận đủ business context và thực hiện một transition hợp lệ theo rule của chính B.

Ví dụ, billing quá hạn không tự thay room state; incident đang mở không tự đổi tenancy state; listing hidden không có nghĩa room đã archived.

## 6. Persistence and Enrichment Rule

Persistence có nhiệm vụ lưu, tìm và phục hồi business knowledge. Persistence không định nghĩa business flow.

Database chưa tồn tại không phải lý do để business flow invent full object giả. Nếu hệ thống hiện chỉ biết một actor reference hoặc room reference, đó là mức knowledge hợp lệ cho tới khi nguồn có thẩm quyền enrich thêm dữ liệu.

Nguyên tắc chung:

- unknown data vẫn là unknown;
- authoritative source mới được enrich knowledge;
- repository/storage implementation có thể thay đổi mà ownership và lifecycle không được thay đổi theo.

## 7. Supporting Surfaces

### Listing / Discovery / Map

Các capability này hỗ trợ tìm và trình bày phòng. Chúng không được tái định vị TrọƠi thành search-first marketplace và không được sở hữu post-rental operational state.

### Dashboard

Dashboard là read surface tổng hợp operational data. Nó không phải business owner của room, debt, receipt hoặc incident.

### Notification

Notification là side-effect/delivery concern. Notification có thể nói rằng một business fact đã xảy ra nhưng không sở hữu source fact đó.

### Audit / Trust

Audit lưu vết fact và history. Audit không được tự suy luận ai đúng/sai hoặc thay thế business rule của module nguồn.

## 8. Phase Boundaries in System Design

MVP phải hoạt động được mà không cần một open service marketplace, payment platform hoàn chỉnh hoặc AI/OCR core dependency.

Phase 2 mới có thể thử controlled partner discovery/connection với partner đã xác minh ở phạm vi hẹp khi có đủ incident data thật.

Phase 3 mới có thể mở rộng sang payment integration sâu hơn, system receipt, AI/OCR nếu có nhu cầu được chứng minh, gói bảo trì định kỳ và marketplace có kiểm soát.

Backend không được implement Phase 2/3 assumption như thể đó là invariant bắt buộc của MVP.

## 9. Project Reading Flow

Canonical reading order trước implementation:

1. root `README.md`;
2. `docs/PROJECT_CONTEXT.md`;
3. `docs/USE_CASES.md`;
4. `docs/SYSTEM_CONTEXT.md`;
5. target module `README.md`;
6. target module `ARCHITECTURE.md`;
7. README/ARCHITECTURE của collaborator được use case tham chiếu;
8. implementation hiện có.

Một cross-module use case bắt buộc đọc tài liệu của tất cả bounded context có quyền sở hữu hoặc decision liên quan. Chỉ hiểu target module mà bỏ qua collaborator boundary có thể tạo implementation cục bộ đúng nhưng toàn hệ thống sai.

## 10. Conflict Resolution Between Documentation Layers

Project-level docs là authority cho product intent, actors, use-case framing và lý do các module phối hợp.

Module-level `ARCHITECTURE.md` là authority cho ownership, lifecycle, state và invariant của module đó.

Nếu hai tầng mâu thuẫn, không được âm thầm ưu tiên một bên. Conflict phải được làm rõ bằng architectural decision hoặc spec update trước khi implementation tiếp tục.

Nếu một feature mới không map được vào owner hiện tại mà chỉ có thể triển khai bằng cách làm nhiều module cùng sở hữu một state, đó là dấu hiệu cần thiết kế bounded context hoặc contract mới thay vì nối tắt qua internals.
