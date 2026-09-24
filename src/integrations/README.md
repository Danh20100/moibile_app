# External Integrations

`src/integrations/` is the backend infrastructure boundary for external APIs, SDKs, and service providers.

## Rules

- Provider-specific SDKs and payloads stay inside their integration folder.
- Integrations return internal contracts instead of leaking vendor payload types into `src/modules/`.
- Integrations do not create TrọƠi users, assign roles, decide permissions, persist domain state, or issue sessions/tokens.
- Each real provider gets its own folder only when a concrete use case exists.
- Do not add placeholder folders for providers that are not implemented yet.

Business and application concerns remain in `src/modules/`; external communication and vendor normalization remain in `src/integrations/`.
