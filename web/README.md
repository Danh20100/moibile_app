# TrọƠi Web

Frontend SPA tối giản cho Vercel. Không có framework runtime và không có dependency production.

## Commands

```powershell
npm run check
npm test
npm run dev
```

## Runtime config

`runtime-config.js`:

- `demoMode: true`: dùng dữ liệu preview local.
- `demoMode: false`: không giả backend; auth cần OpenAPI adapter.

Không thêm endpoint vào `src/core/api.js` cho tới khi OpenAPI contract được cung cấp.
