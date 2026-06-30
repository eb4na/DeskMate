# Memobun marketing website

A small, self-contained static site (plain HTML/CSS/JS — **no build step**) for
**memobun.app**. Open `index.html` in any browser to preview it locally.

```
website/
  index.html        ← the landing page
  privacy.html      ← Privacy Policy + Terms (your App Store "Privacy Policy URL")
  styles.css
  script.js
  assets/           ← logo, app icon, character art, room backdrop, screenshots
  _headers          ← Cloudflare cache rules
  wrangler.toml     ← optional CLI deploy config
```

Preview locally:
```bash
open website/index.html          # macOS
# or serve it: python3 -m http.server 8080 --directory website
```

---

## 1. Add real app screenshots (optional — the site looks finished without them)

The "A peek inside" gallery shows cozy placeholder tiles until you drop in real
screenshots. To add them, take screenshots **on your phone** (your real account has
the populated streaks, friends, and multiplayer rooms that look best), then save the
images into `assets/screenshots/` with these exact names:

| File (any of .png / .jpg / .webp) | Screen to capture                |
|-----------------------------------|----------------------------------|
| `assets/screenshots/home`         | Home — your bakery & companion   |
| `assets/screenshots/study`        | A study session in progress      |
| `assets/screenshots/shop`         | The shop (outfits / rooms)       |
| `assets/screenshots/multiplayer`  | A multiplayer "study together" room |

Example: `assets/screenshots/home.png`. Reload the page and the tile shows your real
screenshot automatically. Tall phone screenshots (iPhone aspect) fit best. Keep each
file under ~400 KB if you can (you can shrink with Preview → Tools → Adjust Size, or
`sips -Z 1200 home.png --out home.png`).

You can add more later by following the same pattern (the slot name is the `data-shot`
value in `index.html`).

---

## 2. Publish to Cloudflare Pages + point your Porkbun domain

You only do steps A and B once. Everything here is done in **your** Cloudflare and
Porkbun accounts.

### A. Put the site on Cloudflare Pages
1. Make a free account at <https://dash.cloudflare.com>.
2. Left sidebar → **Workers & Pages** → **Create** → **Pages** tab → **Upload assets**
   (the "Direct Upload" option — no GitHub needed).
3. Give the project a name (e.g. `memobun`) and **drag the contents of this `website/`
   folder** into the uploader (the files themselves — `index.html` should be at the top
   level of what you upload, not inside another folder). Click **Deploy**.
4. Cloudflare gives you a temporary URL like `memobun.pages.dev` — open it to confirm
   the site works.

> Prefer the command line? From inside `website/`: `npx wrangler login` then
> `npx wrangler pages deploy .` (uses `wrangler.toml`).

### B. Connect memobun.app
1. In your Pages project → **Custom domains** → **Set up a domain** → enter
   `memobun.app`. Cloudflare will tell you to move the domain's DNS to Cloudflare.
2. It will show **two nameservers** (e.g. `xxx.ns.cloudflare.com`).
3. Log in to **Porkbun** → your domain `memobun.app` → **Authoritative Nameservers** →
   replace Porkbun's nameservers with the two Cloudflare gave you → save.
4. Back in Cloudflare, also add `www.memobun.app` as a custom domain (it will create a
   redirect to the apex automatically).
5. DNS changes take anywhere from a few minutes to a few hours. Once it's live,
   `https://memobun.app` and `https://memobun.app/privacy` will load, with HTTPS
   handled automatically by Cloudflare.

> Don't want to move nameservers? Alternative: keep DNS at Porkbun and add a **CNAME**
> record for `www` → `memobun.pages.dev`, plus an **ALIAS/ANAME** on the root `@` →
> `memobun.pages.dev` (Porkbun supports ALIAS). Nameserver delegation (above) is the
> simpler, more reliable path.

### Updating the site later
Re-upload the `website/` contents in the Pages project (or re-run
`npx wrangler pages deploy .`). The custom domain stays connected.

---

## Notes
- The **Privacy Policy URL** for App Store Connect is `https://memobun.app/privacy`
  (served by `privacy.html`). Its text mirrors the in-app policy in
  `src/constants/legal.ts` — if you change one, update the other.
- The character art and room backdrop in `assets/` are **resized copies** of the app
  art; the originals in `assets/images/` are untouched.
- Hanji (the secret companion) is intentionally shown only as a locked "secret
  companion" teaser, to avoid spoiling the in-app surprise.
