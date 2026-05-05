# Voice / video calls (WebRTC)

## TURN / ICE

Set on the API host:

- `TURN_SECRET` — shared secret for coturn REST credentials (required for relay on restrictive networks).
- `TURN_URLS` — comma-separated turn URIs, e.g. `turn:turn.example.com:3478?transport=udp`.

Without these, clients fall back to **STUN only** and calls often fail outside LAN.

## Push wake

On `call:invite`, the API emits socket `call:incoming` and sends an **FCM data-only** message (`type: incoming_call`) so the callee can wake the app. Full **CallKit / ConnectionService** ringing requires extra native setup (VoIP cert, `react-native-callkeep`, etc.).

## iOS VoIP token

`POST /calls/voip-token` stores `voipPushToken` on the user document when the mobile app registers a PushKit token. Wire this to your VoIP push provider (APNs VoIP) to show the system incoming-call UI.
