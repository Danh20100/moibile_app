# Google Identity Integration

This integration verifies Google ID tokens and normalizes verified Google claims into TrọƠi's internal `GoogleIdentity` contract.

## Input

A Google ID token obtained by the client application.

## Configuration

`GOOGLE_CLIENT_ID` is the expected audience used during verification.

`.env.example` documents the variable, but this integration does not install an application-wide env loader. The factory reads `process.env` only when it is explicitly constructed; wiring that factory into an auth endpoint belongs to a later task.

## Output

~~~ts
interface GoogleIdentity {
  subject: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  pictureUrl?: string;
}
~~~

`subject` comes from Google's `sub` claim and is the stable external identity key. Email is optional metadata and must not replace `sub` as the identity key.

## Boundary

This folder does not create TrọƠi users, persist identities, issue JWT/session tokens, assign roles, manage organizations, or expose HTTP endpoints.
