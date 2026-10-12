# Local PostgreSQL DemoPay runner

This development entry point is separate from production `AppModule`, Google auth and MoMo. It binds loopback, authenticates only the three synthetic fixture accounts and accepts only explicit DEMO checkout creation. Bearers expire after 15 minutes and are never printed or persisted. Public payment capabilities still require signed provider evidence.

The configured host `.env` connection failed with PostgreSQL `28P01`. The active runner uses the existing backend container's working configuration without extracting credentials or changing passwords. Compiled reviewed code lives separately in `/tmp/trooi-demo`; the normal backend process is unchanged.

From the backend worktree, compile and stage the runner:

```powershell
node node_modules/typescript/bin/tsc -p tsconfig.build.json
docker exec trooi-project-backend-1 mkdir -p /tmp/trooi-demo/scripts/demo
docker cp build trooi-project-backend-1:/tmp/trooi-demo/
docker cp scripts/demo/fixture.cjs trooi-project-backend-1:/tmp/trooi-demo/scripts/demo/fixture.cjs
docker cp scripts/demo/serve.cjs trooi-project-backend-1:/tmp/trooi-demo/scripts/demo/serve.cjs
docker exec -e NODE_PATH=/app/node_modules:/app/node_modules/.pnpm/node_modules -e NODE_ENV=development trooi-project-backend-1 node /tmp/trooi-demo/scripts/demo/serve.cjs
```

Keep that terminal running. In another terminal:

```powershell
node scripts/demo/forward.cjs
```

Forward the emulator loopback port using the installed Android SDK's ADB:

```powershell
adb -s emulator-5554 reverse tcp:3001 tcp:3001
```

API origin: `http://localhost:3001/api/v1`. Browser pay URLs use the same localhost origin. The Docker relay creates one Docker exec per TCP connection; it is intended for local demonstration traffic.

The configured database initially lacked the gateway schema. The repository's existing migrations `000003` through `000006` were applied using `node-pg-migrate` through the configured container connection. No new migration or domain schema was authored. The current database has those migrations applied. A fresh database must apply the same approved migrations before checkout creation; never run a reset/down command to prepare this demo.

The seed uses the reserved UUIDs exported by `fixture.cjs`, creates absent entities in one transaction and checks relationship collisions. It never resets existing checkouts, payments, allocations or rental lifecycle. Historical manual transfers and the historical deposit application are fixture facts, separate from gateway confirmation. Repeated verification preserves all confirmed payments.

Verify actual HTTP and PostgreSQL behavior:

```powershell
node scripts/demo/verify.cjs
```

The check covers invalid credentials/bearers, relationship scope, outsider access, DEMO-only gates including mixed-case paths, read-only page opening, amount conflict, explicit signed confirmation, duplicate confirmation, one provider-verified Payment and no automatic allocation/deposit application/Receipt. It adds one simulated 1,000 VND Payment per successful probe. No real money transfers. Three confirmed gateway probe records exist at the current checkpoint, alongside the two historical manual records; charges remain unallocated.

Restarting the isolated runner rotates its transient signing key and invalidates old pay URLs. Keep it alive during the demo. Android integration must refresh/replay the same immutable checkout intent to recover a stale URL, rather than infer payment from browser return or silently issue a second intent.

Android still needs canonical UUID alignment, a scoped fixture bearer bridge, review/browser/return/status/history UI and actual runtime verification. The runner and passing HTTP check are not an Android end-to-end completion claim.
