# Handoff Review — <mô tả ngắn>

```yaml
review_of: docs/superpowers/handoff/<handoff-file>.md
reviewer: <reviewer>
reviewed_sha: <git-sha>
status: accepted | changes-requested | owner-decision-required
```

## Phạm vi review

Ghi chính xác những gì đã được review:

```text
files / commits / runtime evidence / tests / CI run / handoff sections
```

Ghi luôn phần **không** được review để tránh hiểu nhầm rằng không có finding đồng nghĩa với đã approve toàn bộ.

## Findings

### Finding 1 — <tiêu đề ngắn>

**Classification:** `CONFIRMED_DEFECT | INTENTIONAL_DEVIATION | CONTEXT_MISSING | PROPOSED_IMPROVEMENT | NEEDS_OWNER_DECISION`

**Observed fact**

Chỉ mô tả điều có thể quan sát trực tiếp.

**Inferred intent**

Nếu intent chưa được chứng minh, ghi:

```text
Possible rationale - unverified: <rationale>
```
Nếu không có inferred intent, ghi `none`.

**Verified intent**

Dẫn nguồn explicit cho intent hoặc ghi `none`.

**Evidence**

Ghi evidence cụ thể, ví dụ:

```text
file/path:line hoặc symbol
commit SHA / message
test name và result
CI run / artifact
spec / plan / handoff section
owner statement
```

**Why this matters**

Giải thích impact kỹ thuật/sản phẩm mà không suy đoán động cơ.

**Reviewer recommendation**

Nêu action được đề xuất và trade-off tương ứng.

**Owner decision**

Dùng một trong các giá trị:

```text
not required
pending
accepted recommendation
rejected recommendation
custom decision: <text>
```
## Intentional deviations được giữ lại

Liệt kê những deviation nên được giữ vì rationale đã được xác minh hoặc owner chấp nhận.

Nếu không có:

```text
None.
```

## Owner decision còn mở

Chỉ liệt kê các `NEEDS_OWNER_DECISION` chưa được giải quyết.

Nếu không có:

```text
None.
```

## Kết luận review

Tóm tắt:

```text
confirmed defects: N
intentional deviations: N
context missing: N
proposed improvements: N
owner decisions required: N
```

`status` cuối cùng phải khớp metadata ở đầu file.
