# Handoff

This directory is the canonical location for agent-to-agent handoff documents.

## File naming

Use:

```text
<recipient>-<YYYYMMDD-HHmmss>-<short-description>.md
```

Rules:
- `recipient`: lowercase agent/person handle, e.g. `duyanh`.
- timestamp: local project time (`Asia/Ho_Chi_Minh`, UTC+07:00).
- `short-description`: concise kebab-case scope.
- one handoff event = one immutable timestamped Markdown file.

Backend handoffs currently target `duyanh`.

Do not create a generic root `HANDOFF.md`. Each handoff must live here and be self-contained enough for the recipient to continue without chat history.
