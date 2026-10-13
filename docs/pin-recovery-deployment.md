# POPA TextBee PIN recovery deployment checklist

This feature is **not enabled in production** until the following are complete:

1. Review and apply `migrations/20261013_member_pin_resets.sql` to the correct POPA Neon database (after database backup).
2. In the Vercel POPA project, configure secret environment variables for the correct environment:
   - `TEXTBEE_API_KEY` (TextBee API key; never commit its value).
   - `POPA_PIN_RECOVERY_SECRET` (unique randomly generated secret, at least 32 characters; keep stable across deployments).
   - `TEXTBEE_DEVICE_ID` (optional, if using a specific paired TextBee Android device).
3. Ensure the registered TextBee Android device is online, SMS permission is enabled, and a working SIM has SMS credit.
4. Build the development branch and test requests, invalid/expired codes, rate limits, account lookup behaviour and session invalidation with a test member account.
5. Verify existing member login and admin sessions are unaffected. Approve production promotion only after those checks.

Recovery sends four-digit codes to the number already stored on the member record. Codes expire after five minutes. Do not reveal whether a requested phone number exists.

The current implementation is **not** an email reset, and does not provide an unauthenticated PIN change without an SMS verification code.
