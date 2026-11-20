# ASL Pad server

A small Cloudflare Worker that keeps the pad data of a pilot (logbook, calendar, alarms, home screen) in step
between devices. Sign-in is the pilot's vAMSYS account: the pad sends its vAMSYS token, the worker asks vAMSYS
who it is and stores the data under that pilot. No passwords and no secrets in this repo or in the pad.

## Switching it on (once)

1. Free Cloudflare account → `npx wrangler login`
2. In this folder: `npx wrangler kv namespace create PAD` and put the printed id into `wrangler.toml`
3. `npx wrangler deploy` – it prints the address, e.g. `https://asl-pad.<name>.workers.dev`
4. Put that address into `va/server.json` (`"url"`) and commit. The pad syncs from then on for every pilot
   who is signed in with vAMSYS. Empty `url` = no server, everything stays on the device as before.

## Not yet

Push notifications to a closed pad and e-mail need more than this (VAPID keys, a mail service) and come later.
