# Voice / video calls (WebRTC)

## TURN / ICE

Set on the API host:

- `TURN_SECRET` — shared secret for coturn REST credentials (required for relay on restrictive networks).
- `TURN_URLS` — comma-separated turn URIs, e.g. `turn:turn.example.com:3478?transport=udp`.
- `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_AUTH_KEY` or `APNS_AUTH_KEY_PATH`, `APNS_VOIP_TOPIC`, `APNS_ENV` — APNs VoIP push credentials for iOS CallKit background ringing.

Without these, clients fall back to **STUN only** and calls often fail outside LAN.

## Push wake

On `call:invite`, the API emits socket `call:incoming`, sends an **FCM data-only** message (`type: incoming_call`), and sends APNs VoIP pushes to stored PushKit tokens when APNs env is configured.

## iOS VoIP token

`POST /calls/voip-token` stores the PushKit token on the user document. APNs failures with status 400/410 are cleaned from `voipTokens`.
