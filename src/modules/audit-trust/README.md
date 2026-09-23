# Audit & Trust Module

> Trạng thái: skeleton bounded context.

## Trách nhiệm

Cung cấp lớp lưu vết và cơ chế trust nội bộ cho các thay đổi quan trọng trong hệ thống.

## Sở hữu

- Audit event cho thay đổi quan trọng.
- Actor/action/resource/timestamp metadata.
- Internal report flow.
- Lịch sử phục vụ tra cứu và đối chiếu.

## Không thuộc module

- Public rating/review marketplace.
- Phán xử tranh chấp.
- Cam kết pháp lý hoặc cưỡng chế các bên ngoài đời thực.

## Quan hệ chính

Cross-cutting với `identity-access`, `tenancy`, `billing`, `receipt`, `incident`, `onboarding` và các module có dữ liệu quan trọng.

MVP ưu tiên lưu vết, report nội bộ và dữ liệu đối chiếu thay vì cơ chế đánh giá công khai.
