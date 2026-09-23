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
- ESLint dùng flat config; Prettier chỉ chịu trách nhiệm formatting.
- Debug dùng Node.js Inspector; không thêm debugger package riêng.
- Không thêm ORM, PostgreSQL client, Redis client, MinIO SDK, auth strategy, Swagger bootstrap, test framework, Docker, CI/CD hay observability trong plan này.
- Không sửa nội dung/boundary của 12 `src/modules/*/README.md`.

## Review Focus

1. **Fresh install:** `pnpm install --frozen-lockfile` phải thành công từ lockfile đã commit; Task 1 kiểm tra trực tiếp.
2. **Build pollution:** `pnpm build` phải chỉ tạo `build/`, và `git status --short` không được xuất hiện build artifacts; Task 3 kiểm tra trực tiếp.
3. **Existing module preservation:** danh sách 12 bounded modules trước/sau implementation phải giống nhau; Task 3 kiểm tra bằng `git diff`/directory listing.
4. **Static tooling compatibility:** `pnpm typecheck`, `pnpm lint` và `pnpm format:check` phải cùng pass trên bootstrap source/config; Task 4 kiểm tra trực tiếp.
5. **Debug attach:** `pnpm start:debug` phải mở Node Inspector ở port `9229` và VS Code attach config phải trỏ đúng port/source maps; Task 5 kiểm tra trực tiếp.

---

## File Map

**Create:**

- `package.json` — package metadata, dependencies và development scripts.
- `pnpm-lock.yaml` — lockfile do pnpm tạo.
- `nest-cli.json` — source root và Nest CLI compiler behavior.
- `tsconfig.json` — TypeScript compiler configuration chính.
- `tsconfig.build.json` — build-only compiler exclusions.
- `eslint.config.mjs` — ESLint flat configuration cho TypeScript/Node.
- `.prettierrc` — formatting rules.
- `.editorconfig` — editor-independent whitespace/EOL rules.
- `.vscode/launch.json` — VS Code attach configuration cho Node Inspector.
- `.vscode/settings.json` — workspace formatting/lint integration.
- `.vscode/extensions.json` — extension recommendations.
- `src/main.ts` — NestJS application bootstrap.
- `src/app.module.ts` — root NestJS module, không wire business modules ở bước này.

**Must remain unchanged:**

- `.gitignore`
- `src/modules/**`
- `docs/backend-tech-stack.md`
- `docs/tech-stack-summary.md`

---

### Task 1: Initialize pnpm package and install the approved dependency set

**Files:**
- Create: `package.json`
- Create: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: repository root on `backend/core-foundations` with no existing Node package metadata.
- Produces: local package executable surface (`pnpm exec nest`, `pnpm exec tsc`, `pnpm exec eslint`, `pnpm exec prettier`) and a reproducible lockfile.

- [ ] **Step 1: Verify the package metadata is still absent**

Run from the backend worktree root:

```powershell
Test-Path package.json
Test-Path pnpm-lock.yaml
```

Expected before implementation:

```text
False
False
```

If either file already exists, stop and inspect it instead of overwriting it.

- [ ] **Step 2: Initialize the pnpm package**

Run:

```powershell
pnpm init
```

Then replace the generated `scripts` object in `package.json` with exactly:

```json
{
  "start": "nest start",
  "start:dev": "nest start --watch",
  "start:debug": "nest start --debug 9229 --watch",
  "build": "nest build",
  "typecheck": "tsc --noEmit -p tsconfig.json",
  "lint": "eslint \"src/**/*.ts\" --max-warnings=0",
  "format": "prettier --write \"src/**/*.ts\" \"*.{json,mjs}\" \".vscode/*.json\"",
  "format:check": "prettier --check \"src/**/*.ts\" \"*.{json,mjs}\" \".vscode/*.json\""
}
```

Do not add database/auth/test scripts in this task.

- [ ] **Step 3: Install runtime dependencies**

Run:

```powershell
pnpm add @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs
```

Expected: dependencies are written to `package.json` and `pnpm-lock.yaml`.

- [ ] **Step 4: Install development dependencies**

Run:

```powershell
pnpm add -D typescript @types/node ts-node @nestjs/cli @nestjs/schematics eslint @eslint/js typescript-eslint globals prettier eslint-config-prettier
```

Expected: all approved development dependencies appear in `devDependencies`; no ORM/auth/database/test packages appear.

- [ ] **Step 5: Verify lockfile reproducibility**

Run:

```powershell
pnpm install --frozen-lockfile
```

Expected: exit code `0` and no lockfile mutation.

- [ ] **Step 6: Inspect package scope**

Run:

```powershell
pnpm list --depth 0
```

Expected top-level runtime packages:

```text
@nestjs/common
@nestjs/core
@nestjs/platform-express
reflect-metadata
rxjs
```

Expected development package set includes:

```text
typescript
@types/node
ts-node
@nestjs/cli
@nestjs/schematics
eslint
@eslint/js
typescript-eslint
globals
prettier
eslint-config-prettier
```

- [ ] **Step 7: Commit package foundation**

```powershell
git add package.json pnpm-lock.yaml
git commit -m "chore: initialize backend package tooling"
```

---

### Task 2: Add TypeScript and NestJS compiler configuration

**Files:**
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `nest-cli.json`

**Interfaces:**
- Consumes: local `typescript` and `@nestjs/cli` from Task 1.
- Produces: strict TypeScript compilation with Nest decorator metadata and all build output under `build/`.

- [ ] **Step 1: Create `tsconfig.json`**

Use exactly:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./build",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 2: Create `tsconfig.build.json`**

Use exactly:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "build", "test", "tests", "**/*.spec.ts"]
}
```

- [ ] **Step 3: Create `nest-cli.json`**

Use exactly:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "tsConfigPath": "tsconfig.build.json"
  }
}
```

- [ ] **Step 4: Verify config syntax and output target**

Run:

```powershell
pnpm exec tsc --showConfig -p tsconfig.build.json
```

Expected: command exits `0`; resolved compiler config contains `outDir` ending in `build` and `strict: true`.

- [ ] **Step 5: Commit compiler configuration**

```powershell
git add tsconfig.json tsconfig.build.json nest-cli.json
git commit -m "chore: configure typescript and nest build"
```

---

### Task 3: Add the minimal NestJS application bootstrap without touching bounded modules

**Files:**
- Create: `src/app.module.ts`
- Create: `src/main.ts`
- Verify unchanged: `src/modules/**`

**Interfaces:**
- Consumes: NestJS runtime packages and TypeScript compiler configuration.
- Produces: `AppModule` root module and an HTTP NestJS application listening on `process.env.PORT ?? 3000`.

- [ ] **Step 1: Capture the current bounded-module directory list before edits**

Run:

```powershell
Get-ChildItem src/modules -Directory | Select-Object -ExpandProperty Name | Sort-Object
```

Expected exactly 12 names:

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

Use exactly:

```typescript
import { Module } from '@nestjs/common';

@Module({})
export class AppModule {}
```

Do not import any of the 12 bounded modules yet.

- [ ] **Step 3: Create `src/main.ts`**

Use exactly:

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

- [ ] **Step 4: Typecheck the bootstrap**

Run:

```powershell
pnpm typecheck
```

Expected: exit code `0`.

- [ ] **Step 5: Build the application**

Run:

```powershell
pnpm build
```

Expected:

```text
build/main.js
build/app.module.js
```

and no generated application JS under `dist/`.

- [ ] **Step 6: Verify build artifacts are ignored and bounded modules are unchanged**

Run:

```powershell
git status --short
git diff -- src/modules
Get-ChildItem src/modules -Directory | Select-Object -ExpandProperty Name | Sort-Object
```

Expected:

- `build/` does not appear in `git status --short`;
- `git diff -- src/modules` prints nothing;
- the same 12 module directory names from Step 1 remain.

- [ ] **Step 7: Smoke-run the compiled application**

Run:

```powershell
node build/main.js
```

Expected: Nest logs successful application start and listens on port `3000`. Stop it with `Ctrl+C` after startup is confirmed.

- [ ] **Step 8: Commit application bootstrap**

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
- Consumes: `eslint`, `@eslint/js`, `typescript-eslint`, `globals`, `eslint-config-prettier`, `prettier` from Task 1.
- Produces: deterministic static-analysis and formatting commands used by the repository scripts.

- [ ] **Step 1: Create `eslint.config.mjs`**

Use exactly:

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

Use exactly:

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

Use exactly:

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

- [ ] **Step 4: Run the formatter once on the scoped files**

Run:

```powershell
pnpm format
```

Expected: only `src/**/*.ts`, root JSON/MJS files and `.vscode/*.json` when present are formatted; module README markdown files are not rewritten by this script.

- [ ] **Step 5: Verify static tooling**

Run:

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
```

Expected: all three commands exit `0`.

- [ ] **Step 6: Verify existing module documentation has not changed**

Run:

```powershell
git diff -- src/modules
```

Expected: no diff.

- [ ] **Step 7: Commit code-quality tooling**

```powershell
git add eslint.config.mjs .prettierrc .editorconfig package.json src/app.module.ts src/main.ts
git commit -m "chore: add backend lint and format tooling"
```

If `package.json`, `src/app.module.ts` or `src/main.ts` have no changes after formatting, Git simply stages nothing extra for those paths.

---

### Task 5: Add VS Code development and debugger configuration

**Files:**
- Create: `.vscode/launch.json`
- Create: `.vscode/settings.json`
- Create: `.vscode/extensions.json`

**Interfaces:**
- Consumes: `pnpm start:debug`, source maps, Node Inspector port `9229`.
- Produces: a repeatable VS Code attach workflow plus formatter/linter recommendations.

- [ ] **Step 1: Create `.vscode/launch.json`**

Use exactly:

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

Use exactly:

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

Use exactly:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "editorconfig.editorconfig"
  ]
}
```

- [ ] **Step 4: Verify the debug script opens Node Inspector**

Run in terminal 1:

```powershell
pnpm start:debug
```

Expected output includes an inspector endpoint on port `9229`, such as:

```text
Debugger listening on ws://127.0.0.1:9229/...
```

and NestJS starts successfully. Leave it running for the next step.

- [ ] **Step 5: Verify VS Code attach configuration**

In VS Code, open **Run and Debug** and run **Attach NestJS Debugger**.

Set a temporary breakpoint on this line in `src/main.ts`:

```typescript
const app = await NestFactory.create(AppModule);
```

Restart the debug process once. Expected: VS Code pauses on the TypeScript source line, proving source-map resolution works. Remove the breakpoint afterward and stop `pnpm start:debug`.

- [ ] **Step 6: Re-run formatter check after adding VS Code JSON files**

Run:

```powershell
pnpm format:check
```

Expected: exit code `0`.

- [ ] **Step 7: Commit editor/debug configuration**

```powershell
git add .vscode/launch.json .vscode/settings.json .vscode/extensions.json
git commit -m "chore: add backend vscode development setup"
```

---

### Task 6: Final fresh-install and foundation verification

**Files:**
- Verify all files created by Tasks 1–5.
- Verify unchanged: `src/modules/**`, shared docs and `.gitignore`.

**Interfaces:**
- Consumes: complete foundation from Tasks 1–5.
- Produces: fresh evidence that another developer can clone/install/build/run the backend without hidden local state.

- [ ] **Step 1: Confirm the working tree is clean before verification**

Run:

```powershell
git status --short
```

Expected: no output.

- [ ] **Step 2: Remove installed/generated local state**

Run:

```powershell
if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }
if (Test-Path build) { Remove-Item -Recurse -Force build }
```

Expected: both local generated directories are absent.

- [ ] **Step 3: Reinstall strictly from the committed lockfile**

Run:

```powershell
pnpm install --frozen-lockfile
```

Expected: exit code `0` with no lockfile modification.

- [ ] **Step 4: Run the full static/build verification suite**

Run sequentially:

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

Expected: every command exits `0`; compiled JS/source maps appear only under `build/`.

- [ ] **Step 5: Smoke-test development startup**

Run:

```powershell
pnpm start:dev
```

Expected: NestJS starts successfully on port `3000`. Stop with `Ctrl+C` after startup is confirmed.

- [ ] **Step 6: Verify no generated files polluted Git and no existing modules changed**

Run:

```powershell
git status --short
git diff -- src/modules
git diff -- .gitignore docs/backend-tech-stack.md docs/tech-stack-summary.md
```

Expected: all commands produce no unexpected changes; `build/` and `node_modules/` do not appear in Git status.

- [ ] **Step 7: Verify exact bounded-module count**

Run:

```powershell
(Get-ChildItem src/modules -Directory).Count
```

Expected:

```text
12
```

- [ ] **Step 8: Record final evidence before claiming completion**

Capture the terminal output for:

```powershell
pnpm --version
node --version
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
git status --short
```

Do not claim the foundation is complete unless these are fresh successful results from the current branch/worktree.
