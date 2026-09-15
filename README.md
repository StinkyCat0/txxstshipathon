# txxstshipathon
shipathon mobile app project

## Run it

```bash
npm run dev
```

Starts the FastAPI backend (`:8001`) and the Expo dev server (`:8081`) together, and advertises this
machine's Tailscale IP so a phone on the tailnet reaches both without any firewall change. Falls back
to the LAN address when Tailscale isn't running.

- `npm run dev -- --web` — extra flags are forwarded to `expo start`
- `npm run dev:api` / `npm run dev:mobile` — run one half alone

Then open Expo Go on the phone and scan the QR code (`exp://<tailscale-ip>:8081`). Expo Go must match
the project's SDK version, and Tailscale must be connected on the phone.

The launcher provisions `backend/.venv` with `uv` on first run; `mobile-app/node_modules` comes from
`npm install` in `mobile-app`. `flake.nix` provides node, uv and python for a NixOS dev shell.
