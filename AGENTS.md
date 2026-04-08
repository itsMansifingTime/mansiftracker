<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Local dev server

The agent **may** run `npm run dev` when the user **asks to start** the dev server (once). Otherwise users can run it locally in **one** terminal. See `.cursor/rules/no-auto-dev-server.mdc`.
