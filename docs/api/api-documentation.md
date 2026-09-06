# api-documentation

FastAPI OpenAPI is available at /docs. Core routes include health, analyze, stream, speaker enrollment, transactions and incidents.

## Live telephony

Configure a Twilio phone number's voice webhook to `POST /telephony/twilio/voice` and expose the backend over HTTPS. Set `VOXGUARD_TWILIO_STREAM_URL` to the public `wss://` backend URL (without `/media`), `VOXGUARD_TWILIO_AUTH_TOKEN` to validate webhooks, and `VOXGUARD_TWILIO_FORWARD_TO` to the destination number. The adapter streams the caller leg into the existing audio risk pipeline in four-second windows.

The media WebSocket is intended for Twilio's Media Streams protocol; it is not a local microphone simulator. A public WSS endpoint, a Twilio number, and a configured forwarding destination are required before real calls can be monitored.
