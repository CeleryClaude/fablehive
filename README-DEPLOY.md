# FABLEHIVE — from this folder to fablehive.io

*Everything in this folder is the finished, verified ship package. One server serves the
game page AND the multiplayer room on one port. The page auto-connects to whatever
served it — no URL parameters, no configuration. Your part is four logins and about
20 minutes. (Learned from Bounty Royale: no free tiers — they fall asleep. Render
Starter, ~US$7/mo, always on.)*

---

## WHAT'S IN THE BOX
- `index.html` — the game (single file, 196 laws green). Opens solo from disk; goes online automatically when served by the room.
- `server.js` — the authoritative room. Serves the page + websocket on `PORT`. Health at `/healthz`.
- `package.json` — `npm start` runs the room.
- `render.yaml` — Render blueprint: service **fablehive**, Node, Starter plan, health-checked, auto-deploy.
- `.gitignore`

## STEP 1 — GitHub (5 min) 🫵 *your login*
1. github.com → sign in (or create account) → **New repository** → name: `fablehive` → Private → Create.
2. On the empty repo page: **"uploading an existing file"** link → drag the 5 files from this folder in → Commit.

*(Or tell me when Chrome + the Claude extension is open and I'll drive this step with you watching.)*

## STEP 2 — Render (7 min) 🫵 *your login + card*
1. render.com → **Sign up with GitHub** (one click, links the accounts).
2. **New → Blueprint** → pick the `fablehive` repo → Render reads `render.yaml` → **Apply**.
3. Add your card when asked (Starter ≈ US$7/mo). Wait ~2 min for the first deploy.
4. You now have `https://fablehive.onrender.com` (or similar). **Open it. Press RISE. You are online.**
   Send that URL to a friend on their phone — you'll meet in the meadow. This alone is launchable.

## STEP 3 — the name (5 min) 🫵 *your card*
1. Buy `fablehive.io` — Cloudflare Registrar (at-cost) or Namecheap. Expect ~US$30-40/yr (.io is pricey; that's normal).
2. In Render: your service → **Settings → Custom Domains → Add** `fablehive.io` (and `www.fablehive.io`).
3. Render shows you the DNS records (a CNAME/ANAME target). At your registrar's DNS page, add exactly those records.
4. 5–30 minutes later: **https://fablehive.io** is the game. TLS (the padlock, and `wss://`) is automatic — the client already speaks wss on https.

## STEP 4 — Stripe (later, not launch-blocking) 🫵 *your identity + bank*
Nothing in the game requires Stripe to run — the Royal Sub button currently just explains itself.
When ready: create the Stripe account (business details, bank), make one Product ("Royal Sub", US$5/mo recurring),
and tell me — I'll wire Checkout + the webhook into server.js and we'll test with card 4242 4242 4242 4242 before going live.

## VERIFYING ANY OF IT
- Locally on your PC (optional): `npm install && npm start` in this folder → http://localhost:8081
- The wire trial: `node net_test.js` (from the main game folder) — 10 laws: join, steer, speak, buy, die, rise.
- Render's own health check pings `/healthz` — if the room ever dies, Render restarts it.

## KNOWN LIMITS OF v1 (all fine for launch)
- One room, 6 human seats; empty seats are the wild rivals. Extra visitors get "full" (room orchestration is Phase 2).
- Cosmetic progression is per-browser (localStorage) until accounts arrive with Stripe.
- Server restarts (deploys) reset the meadow — matches the .io round ethos.

*Steps 1–3 and a friend's phone: that's the whole launch.*
