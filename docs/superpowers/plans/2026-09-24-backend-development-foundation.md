# Backend Development Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thiết lập development foundation tối thiểu để backend TrọƠi có thể cài dependency, chạy NestJS, debug TypeScript, typecheck, lint, format và build ổn định mà chưa kéo database/auth/business implementation vào scope.

**Architecture:** Giữ repository hiện tại và 12 bounded module skeleton nguyên vẹn, bổ sung một NestJS application bootstrap mỏng ở `src/main.ts` + `src/app.module.ts`. Tooling được quản lý ở root bằng pnpm, TypeScript, Nest CLI, ESLint flat config, Prettier, EditorConfig và VS Code workspace files. Build artifact đi vào `build/`, không dùng `dist/`.

**Tech Stack:** pnpm, TypeScript, NestJS, Node.js Inspector, ESLint flat config, Prettier, EditorConfig, VS Code.

**Spec:** `docs/superpowers/specs/2026-09-24-backend-development-foundation-design.md`

## Global Constraints

- Dùng `pnpm` làm package manager.
- Backend là TypeScript + NestJS theo Modular Monolith.
- Không dùng `nest new`; repository hiện có `src/modules/` cần được bảo toàn.
- Build output phải là `build/`, không phải `dist/`.
- TypeScript phải bật strict checking, decorators, emitted metadata và source maps.
- Dùng `NodeNext` compiler semantics theo NestJS hiện hành nhưng **không** thêm `"type": "module"`; application source vẫn ở CommonJS mode cho foundation này và có thể chuyển ESM bằng task riêng sau này.
- ESLint dùng flat config; Prettier chỉ chịu trách nhiệm formatting.
- Debug dùng Node.js Inspector; không thêm debugger package riêng.
- Không thêm ORM, PostgreSQL client, Redis client, MinIO SDK, auth strategy, Swagger bootstrap, test framework, Docker, CI/CD hay observability trong plan này.
- Không sửa nội dung/boundary của 12 `src/modules/*/README.md`.
- Vì spec cố ý chưa chọn test framework và foundation chưa có business behavior, các task dùng command-level acceptance checks thay cho unit tests.
- Khi cài NestJS hiện hành, development Node.js phải đáp ứng yêu cầu của `@nestjs/schematics`: Node `22.22.3+` trên dòng 22, `24.15+` trên dòng 24, hoặc `26+`. Nếu môi trường không đạt, dừng trước khi cài package.

## Review Focus

1. **Fresh install:** `pnpm install --frozen-lockfile` phải thành công từ lockfile đã commit; Task 1 kiểm tra trực tiếp.
2. **Build pollution:** `pnpm build` chỉ được tạo generated state trong `build/`; cả JS/source maps và TypeScript incremental metadata không được làm dirty Git; Tasks 2, 3 và 6 kiểm tra.
3. **Existing module preservation:** danh sách 12 bounded modules và nội dung của chúng không thay đổi; Tasks 3, 4 và 6 kiểm tra.
4. **Static tooling compatibility:** `pnpm typecheck`, `pnpm lint` và `pnpm format:check` phải cùng pass; Tasks 4 và 6 kiểm tra.
5. **Debug attach:** `pnpm start:debug` phải mở Node Inspector ở port `9229` và VS Code attach phải map breakpoint về TypeScript source; Task 5 kiểm tra.

---

## File Map

**Create:**

- `package.json` — package metadata, dependencies và scripts.
- `pnpm-lock.yaml` — pnpm lockfile.
- `nest-cli.json` — Nest CLI source/build configuration.
- `tsconfig.json` — TypeScript configuration chính.
- `tsconfig.build.json` — build exclusions.
- `eslint.config.mjs` — ESLint flat configuration.
- `.prettierrc` — formatting rules.
- `.editorconfig` — editor-independent whitespace/EOL rules.
- `.vscode/launch.json` — Node Inspector attach configuration.
- `.vscode/settings.json` — workspace formatting/lint settings.
- `.vscode/extensions.json` — extension recommendations.
- `src/main.ts` — Nest application bootstrap.
- `src/app.module.ts` — root Nest module.

**Must remain unchanged:** `.gitignore`, `src/modules/**`, `docs/backend-tech-stack.md`, `docs/tech-stack-summary.md`.

---

### Task 1: Initialize package metadata and dependency lockfile

**Files:**
- Create: `package.json`
- Create: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: clean backend worktree with no existing Node package metadata.
- Produces: `pnpm exec nest`, `pnpm exec tsc`, `pnpm exec eslint`, `pnpm exec prettier` and reproducible dependency resolution.

- [ ] **Step 1: Verify package metadata is absent and development runtime is compatible**

```powershell
Test-Path package.json
Test-Path pnpm-lock.yaml
node --version
pnpm --version
```

Expected before implementation:

```text
False
False
```

Node must satisfy one current Nest CLI development line: `22.22.3+`, `24.15+`, or `26+`. If package metadata already exists or Node is outside those supported lines, stop and inspect/upgrade instead of proceeding.

- [ ] **Step 2: Create deterministic `package.json`**

Create exactly:

```json
{
  "name": "trooi-backend",
  "version": "0.1.0",
  "private": true,
  "description": "TrọƠi backend application",
  "engines": {
    "node": "^22.22.3 || ^24.15.0 || >=26.0.0"
  },
  "scripts": {
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug 9229 --watch",
    "build": "nest build",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "lint": "eslint \"src/**/*.ts\" --max-warnings=0",
    "format": "prettier --no-error-on-unmatched-pattern --write \"src/**/*.ts\" \"*.{json,mjs}\" \".vscode/*.json\"",
    "format:check": "prettier --no-error-on-unmatched-pattern --check \"src/**/*.ts\" \"*.{json,mjs}\" \".vscode/*.json\""
  }
}
```

The unmatched-pattern flag is required because `.vscode/` does not exist until Task 5.

- [ ] **Step 3: Install runtime dependencies**

```powershell
pnpm add @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs
```

Expected: packages appear under `dependencies` and pnpm creates `pnpm-lock.yaml`.

- [ ] **Step 4: Install development dependencies**

```powershell
pnpm add -D typescript @types/node ts-node @nestjs/cli @nestjs/schematics eslint @eslint/js typescript-eslint globals prettier eslint-config-prettier
```

Expected: packages appear under `devDependencies`; no database/auth/test packages are added.

- [ ] **Step 5: Verify reproducible installation**

```powershell
pnpm install --frozen-lockfile
pnpm list --depth 0
```

Expected: both commands exit `0`; lockfile is unchanged and all Nest packages resolve to the same current major.

- [ ] **Step 6: Commit package foundation**

```powershell
git add package.json pnpm-lock.yaml
git commit -m "chore: initialize backend package tooling"
```

---

### Task 2: Configure TypeScript and Nest CLI

**Files:**
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `nest-cli.json`

**Interfaces:**
- Consumes: TypeScript and Nest CLI from Task 1.
- Produces: strict Nest-compatible compilation with generated state under ignored `build/`.

- [ ] **Step 1: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "resolvePackageJsonExports": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./build",
    "tsBuildInfoFile": "./build/tsconfig.tsbuildinfo",
    "baseUrl": "./",
    "incremental": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "strict": true,
    "strictPropertyInitialization": false,
    "types": ["node"]
  }
}
```

`tsBuildInfoFile` is intentionally inside `build/` so `typecheck`/incremental compilation cannot create an unignored root `.tsbuildinfo` file.

- [ ] **Step 2: Create `tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "build", "test", "tests", "**/*spec.ts"]
}
```

- [ ] **Step 3: Create `nest-cli.json`**

Use the standard-project shape:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

Do **not** add global `tsConfigPath`; current Nest CLI documents that option for monorepo/default-project selection, while this repository is a standard single application.

- [ ] **Step 4: Verify resolved compiler config and clean generated-state behavior**

```powershell
pnpm exec tsc --showConfig -p tsconfig.build.json
pnpm typecheck
git status --short
```

Expected: `--showConfig` resolves NodeNext, strict mode and `outDir` to `build`; typecheck exits `0` once source bootstrap exists (Task 3), or reports only the expected current absence of root source before Task 3. No root `*.tsbuildinfo` appears in Git status.

- [ ] **Step 5: Commit compiler configuration**

```powershell
git add tsconfig.json tsconfig.build.json nest-cli.json
git commit -m "chore: configure typescript and nest build"
```

---

### Task 3: Add the minimal NestJS bootstrap

**Files:**
- Create: `src/app.module.ts`
- Create: `src/main.ts`
- Verify unchanged: `src/modules/**`

**Interfaces:**
- Consumes: NestJS runtime and compiler configuration.
- Produces: root `AppModule` and HTTP application listening on `process.env.PORT ?? 3000`.

- [ ] **Step 1: Capture existing bounded modules**

```powershell
Get-ChildItem src/modules -Directory | Select-Object -ExpandProperty Name | Sort-Object
```

Expected exactly:

```text
audit-trust
billing
identity-access
incident
listing
onboarding
organization
property
receipt
room
subscription
tenancy
```

- [ ] **Step 2: Create `src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';

@Module({})
export class AppModule {}
```

Do not import the 12 business modules yet.

- [ ] **Step 3: Create `src/main.ts`**

```typescript
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
```

Because `package.json` has no `"type": "module"`, NodeNext emits this application as CommonJS and extensionless relative imports remain valid.

- [ ] **Step 4: Verify typecheck and build**

```powershell
pnpm typecheck
pnpm build
```

Expected: both exit `0`; `build/main.js` and `build/app.module.js` exist; no generated application JS appears under `dist/`.

- [ ] **Step 5: Verify build isolation and module preservation**

```powershell
git status --short
git diff -- src/modules
Get-ChildItem src/modules -Directory | Select-Object -ExpandProperty Name | Sort-Object
```

Expected: `build/` and `*.tsbuildinfo` are absent from Git status, module diff is empty, module list still has the same 12 names.

- [ ] **Step 6: Smoke-run compiled application**

```powershell
node build/main.js
```

Expected: Nest logs successful startup and listens on port `3000`. Stop with `Ctrl+C` after confirmation.

- [ ] **Step 7: Commit bootstrap**

```powershell
git add src/app.module.ts src/main.ts
git commit -m "feat: add minimal nest application bootstrap"
```

---

### Task 4: Add ESLint, Prettier and EditorConfig

**Files:**
- Create: `eslint.config.mjs`
- Create: `.prettierrc`
- Create: `.editorconfig`

**Interfaces:**
- Consumes: lint/format dependencies from Task 1.
- Produces: `pnpm lint`, `pnpm format`, `pnpm format:check`.

- [ ] **Step 1: Create `eslint.config.mjs`**

```javascript
import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['build/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  eslintConfigPrettier,
);
```

- [ ] **Step 2: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "endOfLine": "lf"
}
```

- [ ] **Step 3: Create `.editorconfig`**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 4: Format the configured scope**

```powershell
pnpm format
```

Expected: bootstrap/config files are formatted; `src/modules/**/*.md` is not part of the format script.

- [ ] **Step 5: Verify code-quality gates**

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
git diff -- src/modules
```

Expected: first three commands exit `0`; module diff is empty.

- [ ] **Step 6: Commit code-quality tooling**

```powershell
git add eslint.config.mjs .prettierrc .editorconfig package.json src/app.module.ts src/main.ts
git commit -m "chore: add backend lint and format tooling"
```

---

### Task 5: Add VS Code debugging and workspace configuration

**Files:**
- Create: `.vscode/launch.json`
- Create: `.vscode/settings.json`
- Create: `.vscode/extensions.json`

**Interfaces:**
- Consumes: `pnpm start:debug`, source maps and Node Inspector port `9229`.
- Produces: repeatable VS Code attach workflow and workspace recommendations.

- [ ] **Step 1: Create `.vscode/launch.json`**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach NestJS Debugger",
      "port": 9229,
      "restart": true,
      "protocol": "inspector",
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/build/**/*.js"],
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

- [ ] **Step 2: Create `.vscode/settings.json`**

```json
{
  "editor.formatOnSave": true,
  "eslint.validate": ["typescript"],
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[jsonc]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[markdown]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "files.eol": "\n"
}
```

- [ ] **Step 3: Create `.vscode/extensions.json`**

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "editorconfig.editorconfig"
  ]
}
```

- [ ] **Step 4: Verify Inspector startup**

```powershell
pnpm start:debug
```

Expected output includes an Inspector endpoint on port `9229` and successful Nest startup.

- [ ] **Step 5: Verify TypeScript breakpoint mapping in VS Code**

Run **Attach NestJS Debugger** from Run and Debug. Set a breakpoint on:

```typescript
const app = await NestFactory.create(AppModule);
```

Restart `pnpm start:debug`. Expected: VS Code pauses on the TypeScript source line. Then remove the breakpoint and stop the debug process.

- [ ] **Step 6: Verify formatting after VS Code files exist**

```powershell
pnpm format
pnpm format:check
```

Expected: both exit `0`.

- [ ] **Step 7: Commit editor/debug setup**

```powershell
git add .vscode/launch.json .vscode/settings.json .vscode/extensions.json
git commit -m "chore: add backend vscode development setup"
```

---

### Task 6: Run fresh-install and whole-foundation verification

**Files:**
- Verify everything created in Tasks 1–5.
- Verify unchanged: `.gitignore`, `src/modules/**`, shared stack docs.

**Interfaces:**
- Consumes: complete development foundation.
- Produces: fresh evidence that a clean worktree can install, check, build, run and debug without hidden local state.

- [ ] **Step 1: Confirm clean working tree**

```powershell
git status --short
```

Expected: no output.

- [ ] **Step 2: Remove generated local state**

```powershell
if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }
if (Test-Path build) { Remove-Item -Recurse -Force build }
```

Expected: both directories are absent.

- [ ] **Step 3: Reinstall only from committed lockfile**

```powershell
pnpm install --frozen-lockfile
```

Expected: exit `0` and no lockfile mutation.

- [ ] **Step 4: Run all static/build gates**

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

Expected: every command exits `0`; generated output and incremental metadata remain under `build/`.

- [ ] **Step 5: Smoke-test development mode**

```powershell
pnpm start:dev
```

Expected: Nest starts on port `3000`; stop with `Ctrl+C` after confirmation.

- [ ] **Step 6: Verify existing project material was preserved**

```powershell
git status --short
git diff -- src/modules
git diff -- .gitignore docs/backend-tech-stack.md docs/tech-stack-summary.md
Get-ChildItem -Path . -Filter *.tsbuildinfo -Recurse | Where-Object { $_.FullName -notmatch '[\\/]build[\\/]' }
(Get-ChildItem src/modules -Directory).Count
```

Expected: no unexpected diff/status; the `tsbuildinfo` search returns nothing outside `build/`; module count is:

```text
12
```

- [ ] **Step 7: Capture final evidence before claiming completion**

```powershell
node --version
pnpm --version
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
git status --short
```

Do not claim completion unless these are fresh successful results from the current worktree/branch.
