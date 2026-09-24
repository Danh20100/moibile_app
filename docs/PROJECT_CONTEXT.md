# Project Context

Status: Current product context for backend implementation

## 1. Product Definition

TrọƠi là **sổ vận hành thuê trọ theo từng phòng/tài sản**. Sản phẩm giúp chủ nhà, chủ trọ và người vận hành lưu trữ, theo dõi và đối chiếu các thông tin quan trọng trong suốt quá trình thuê: người thuê ở mức cần thiết, giá thuê, tiền cọc, phụ phí, công nợ, biên nhận hoặc bản ghi thanh toán, sự cố và lịch sử xử lý.

TrọƠi không bắt đầu từ mục tiêu xây một marketplace ba bên hoàn chỉnh. Điểm vào của sản phẩm là một lớp dữ liệu vận hành rõ ràng theo từng phòng hoặc tài sản cho thuê.

## 2. Problem Being Solved

Nhiều chủ trọ và người vận hành vẫn quản lý thông tin bằng giấy tờ, Excel, Zalo, ảnh chụp màn hình chuyển khoản hoặc trí nhớ cá nhân. Các dữ liệu quan trọng vì vậy dễ bị phân tán, khó đối chiếu và khó theo dõi xuyên suốt vòng đời thuê.

Sau khi người thuê vào ở, các vấn đề lặp lại mới xuất hiện thường xuyên: thu tiền thuê, ghi nhận tiền cọc, theo dõi phụ phí, xử lý công nợ, lưu biên nhận, báo sự cố, cập nhật trạng thái phòng và xem lại lịch sử khi có tranh cãi hoặc cần xác minh thông tin vận hành.

TrọƠi giải quyết phần vận hành sau thuê bằng cách tạo một nguồn dữ liệu có cấu trúc theo từng phòng/tài sản thay vì tiếp tục phân tán thông tin qua nhiều công cụ rời rạc.

## 3. Product Positioning

Lõi định vị của TrọƠi là **post-rental operations** — vận hành sau khi phòng hoặc tài sản đã được đưa vào sử dụng.

Tìm phòng, đăng phòng, listing, discovery và map có thể là điểm chạm hỗ trợ trước khi tenancy bắt đầu, nhưng không được dùng để định nghĩa TrọƠi như một search-first marketplace.

Giá trị khác biệt mà backend phải bảo vệ là khả năng giữ hồ sơ vận hành, lifecycle và lịch sử theo từng phòng/tài sản đủ rõ để các bên có thể theo dõi và đối chiếu theo thời gian.

## 4. Actors

### Payer

Payer là chủ nhà, chủ trọ hoặc bên chịu chi phí vận hành và quyết định có trả subscription cho TrọƠi hay không.

### Operator

Operator là người trực tiếp thực hiện công việc vận hành hằng ngày. Operator có thể là chủ trọ, người thân, quản lý khu trọ hoặc nhân viên vận hành.

### Tenant User

Tenant user là người thuê đang tham gia vào một rental context hợp lệ. Tenant có thể xem thông tin được phép, xem hoặc xác nhận biên nhận khi flow yêu cầu, báo sự cố và xem lịch sử phù hợp với quyền của mình.

### Future Service Partner

Future service partner là đối tác dịch vụ vận hành phòng trọ ở các phase sau. Nhóm này không phải một actor cần được kích hoạt đầy đủ trong MVP.

Một người thật có thể đồng thời là payer và operator, nhưng các role business vẫn phải được phân biệt trong architecture.

## 5. Economic Roles

Các actor không đồng nghĩa với nhau về mặt kinh tế.

- **Payer** quyết định trả tiền cho sản phẩm và đánh giá hiệu quả kinh tế của TrọƠi.
- **Operator** tạo và duy trì dữ liệu vận hành hằng ngày.
- **Tenant user** không phải nguồn thu chính của MVP nhưng tạo dữ liệu tương tác và dữ liệu đối chiếu có giá trị.
- **Future service partner** chỉ trở thành một lớp kinh tế đáng kể khi TrọƠi có đủ dữ liệu sự cố và quy trình kiểm soát chất lượng.

Việc phân biệt role giúp tránh thiết kế sai theo hướng tenant-first hoặc marketplace-first trong khi mô hình doanh thu ban đầu vẫn là subscription từ phía chủ trọ/người vận hành.

## 6. Core Domain

Core domain của TrọƠi xoay quanh một chuỗi vận hành theo tài sản thuê:

**Organization → Property → Room → Tenancy → Billing → Receipt**

Các capability liên quan bổ sung context nhưng không làm thay đổi ownership của chuỗi trên:

- `identity-access` xác định identity và access context;
- `incident` quản lý lifecycle sự cố gắn với room và, khi cần, tenancy context;
- `listing` tạo public projection từ room/property cho discovery;
- `onboarding` điều phối nhập dữ liệu ban đầu nhưng không giữ ownership của domain data sau khi tạo;
- `subscription` quyết định entitlement ở mức product;
- `audit-trust` ghi nhận business fact và history mà không chiếm ownership của source lifecycle.

## 7. MVP Scope

MVP tập trung vào các capability sau:

- hồ sơ phòng/tài sản;
- thông tin người thuê ở mức thật sự cần cho vận hành;
- giá thuê, tiền cọc, tiện ích/phụ phí và các điều khoản nền;
- theo dõi khoản phải thu và công nợ theo kỳ;
- biên nhận hoặc bản ghi thanh toán phục vụ đối chiếu;
- ticket sự cố với mô tả, phân loại, attachment khi có, trạng thái và lịch sử xử lý;
- dashboard vận hành cơ bản, ví dụ số phòng đang hoạt động, khoản chưa thu và sự cố chưa xử lý;
- lớp người thuê tối giản để xem thông tin được phép, xem/đối chiếu biên nhận và báo sự cố;
- onboarding hỗ trợ bằng template, bulk input và CSV/Excel khi phù hợp;
- audit/history cho các business fact quan trọng;
- subscription từ phía chủ trọ/người vận hành là logic doanh thu ban đầu.

MVP được giữ hẹp có chủ đích để kiểm chứng xem chủ trọ có sẵn sàng dùng và trả phí cho một công cụ vận hành thay thế quy trình thủ công hay không.

## 8. Non-goals

MVP không được giả định có sẵn:

- marketplace đối tác dịch vụ vận hành mở hoặc không kiểm soát;
- dịch vụ pháp lý hoặc cơ chế phán quyết tranh chấp;
- cam kết kết quả về tiền cọc, chi phí hoặc ai đúng/sai giữa các bên;
- hệ thống thanh toán hoàn chỉnh chạy toàn bộ settlement trong nền tảng;
- AI/OCR như dependency bắt buộc của core flow;
- TrọƠi trực tiếp bảo đảm chất lượng sửa chữa/bảo trì ngoài đời thực;
- một hệ sinh thái ba bên được kích hoạt đồng thời ngay từ MVP;
- public rating như cơ chế trust mặc định.

Nếu một capability nằm ngoài phạm vi này được đề xuất, nó phải được xác nhận bằng scope hoặc spec mới trước khi implementation coi đó là requirement.

## 9. Product Phases

### MVP — Sổ vận hành thuê trọ

Tập trung vào room/asset profile, tenant context cần thiết, công nợ, biên nhận, ticket sự cố, lịch sử xử lý, dashboard cơ bản, onboarding và lớp người thuê tối giản.

### Phase 2 — Controlled Tenant & Partner Activation

Lớp người thuê có thể đầy đủ hơn. Incident flow được cải tiến. Partner discovery và kết nối curated với đối tác đã xác minh chỉ được thử nghiệm ở phạm vi hẹp khi có đủ dữ liệu ticket thật.

### Phase 3 — Controlled Marketplace & Deeper Operations

Có thể bổ sung thanh toán trong nền tảng, system-generated receipt, AI/OCR nếu nhu cầu thật chứng minh cần thiết, gói bảo trì định kỳ, marketplace dịch vụ có kiểm soát và dashboard/analytics nâng cao.

### Long-term

Có thể mở rộng sang căn hộ dịch vụ, chung cư mini và các mô hình tài sản cho thuê lớn hơn, nhưng mọi mở rộng phải giữ được operational record làm nền tảng dữ liệu chính.

## 10. Domain Vocabulary

- **Organization:** phạm vi vận hành cấp cao nhất của một chủ nhà hoặc đơn vị quản lý.
- **Property:** tài sản hoặc khu trọ ở cấp địa điểm.
- **Room:** đơn vị cho thuê cốt lõi và operational anchor.
- **Tenancy:** một kỳ thuê cụ thể giữa room và tenant context.
- **Billing:** khoản phải thu, charge và trạng thái công nợ theo kỳ của tenancy.
- **Receipt:** bản ghi thanh toán/biên nhận phục vụ đối chiếu vận hành.
- **Incident:** sự cố phát sinh trong quá trình vận hành và lifecycle xử lý của nó.
- **Listing:** public projection của room/property phục vụ discovery; không phải operational record.
- **Onboarding:** flow nhập và xác nhận dữ liệu ban đầu trước khi dữ liệu trở thành domain data.
- **Subscription:** capability/entitlement của organization đối với sản phẩm TrọƠi.
- **Audit:** business history dùng để truy vết; không phải nguồn business rule thay thế module gốc.
- **Reference:** cách một bounded context chỉ tới resource thuộc bounded context khác mà không lấy ownership của resource đó.

## 11. Architectural Mental Model

TrọƠi sử dụng **Contract-first + persistence-agnostic business flows**.

Business flow, lifecycle, ownership và invariant phải được hiểu trước persistence hoặc infrastructure cụ thể.

Mỗi bounded context chỉ được biết những gì cần cho trách nhiệm của mình. Khi dữ liệu chưa có nguồn có thẩm quyền, trạng thái đúng của hệ thống là **chưa biết**, không phải một placeholder giả.

Cross-module collaboration ưu tiên reference, decision và event. Một module không được đọc internal representation của module khác rồi tự dựng lại business rule của module đó.

State của room, tenancy, billing, receipt, incident, listing và subscription là các state khác nhau dù có thể liên quan trong cùng một user journey.

## 12. Reading Order for Agents

Trước khi implementation một flow, agent đọc theo thứ tự:

1. root `README.md`;
2. `docs/PROJECT_CONTEXT.md`;
3. `docs/USE_CASES.md`;
4. `docs/SYSTEM_CONTEXT.md`;
5. `README.md` của target module;
6. `ARCHITECTURE.md` của target module;
7. README/ARCHITECTURE của các collaborator được use case tham chiếu;
8. implementation hiện có.

Project-level docs giải thích **vì sao và khi nào** các module phối hợp. Module-level docs vẫn là authority cho ownership, state và invariant cục bộ.

Nếu hai tầng tài liệu mâu thuẫn, implementation phải dừng ở điểm mâu thuẫn đó và làm rõ architecture trước khi tự chọn một cách hiểu.
