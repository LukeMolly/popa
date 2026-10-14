# POPA Security and Release Checklist

## Deployment and authentication
- The membership registration service uses the existing member and payment tables without issuing member credentials.
- Administrator privileges require an active entry in `admin_users` plus a recognised Google OAuth session or an existing administrator PIN session.
- A member session must never be accepted as proof of administrator authority.
- Deployments run schema migrations only. They must never reseed fixed PIN hashes or generate predictable member passwords.
- Existing administrators retain their credentials until changed through the Administrator Access screen. **Before promoting this branch, rotate the permanent executive PIN and reset the PINs for all active administrators**. Old seed hashes remain in Git history, even though the current deployment code no longer uses them.
- PIN changes and administrator removals revoke existing PIN sessions for that account. Consider reviewing/revoking OAuth sessions independently in the identity provider if an account is compromised.
- Never commit credentials, tokens, database URIs or administrator PINs. Use Vercel environment variables and least-privilege service credentials.

## Registration and documents
- membership registration requires an origin-consistent request and applies a 30-attempt/hour throttle per Vercel-reported client IP, plus a 6-attempt/24-hour per-phone limit, using a hashed identifier in the database.
- The backend caps multipart bodies at roughly 5.1 MiB, validates POP content signatures and MIME types, and restricts allowed formats to PDF, JPEG and PNG.
- Files use private Vercel Blob storage. The admin receipt endpoint authorises access before streaming and disallows active/unknown media types.
- Keep the configured Blob store **private**; this is an infrastructure setting and cannot be guaranteed from application code alone.
- Admin APIs enforce origin checks, role-based access, and no-store responses.
- Direct per-member notifications remain separate from the removed Club Updates publishing workflow.

## Required preproduction checks
1. Confirm that both Vercel preview builds pass for the final commit.
2. Test membership registration without member accounts with FNB, Stanbic, Other and Pay Later, with/without POP, including wrong MIME and oversize files.
3. Check that pending POP submissions enter the tally once, can be viewed by authorised admins, and cannot be accessed unauthenticated or by lower-privilege roles.
4. Test admin sign-in, lockout/recovery, PIN rotation, forced logout, account removal, role restrictions and cross-site write rejection.
5. Confirm that the retired member portal and Club Updates endpoints are inaccessible.
6. Ensure the Neon database, private Blob store, OAuth settings and preview/production environment isolation are reviewed.
7. Consider edge/WAF bot protection, audit logging, monitoring, backup/restore tests, and an application penetration test for production.

## Data retention and incident handling
The security changes do not delete members, payments, POPs, historic updates or any other existing data. Set a documented retention period for membership registration records, POPs and administrator session records, and review any exposed credentials with the relevant provider.
