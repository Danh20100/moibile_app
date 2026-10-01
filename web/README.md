# TrọƠi web — marketing surface

The production web entry (`index.html`) is a responsive marketing page for the Android-first rental lifecycle product. It does **not** offer login, booking, subscription, payment or any business-operation routes. All navigation stays inside the landing page.

The older `src/app.js`, `src/views/` and state modules are **inactive legacy UI** retained temporarily for source migration; `index.html` does not load them. They are not evidence of a supported second business application. The current Android release is not backend-integrated or Play-ready.

Run: `npm run check`, `npm test`, `npm run test:browser`, then `npm run dev`. Deploy Vercel with Root Directory `web`; `vercel.json` implements SPA fallback, returning the marketing page for legacy routes without exposing login forms.
