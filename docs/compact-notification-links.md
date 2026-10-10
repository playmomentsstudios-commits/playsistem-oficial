# Compact notification links

WhatsApp project notifications use `/n/<22-character base64url UUID>` instead
of a project/stage/task path. This is a locator for an existing notification,
not a bearer credential. The signed-in recipient filter and notification RLS
must both succeed before the destination is read. Existing project and file
permissions still apply at the destination. Missing notices fail closed.

The current QR bridge sends text messages; it has no reliable URL button API.
Manual sends and the bridge share the same compact outbox destination. Existing
in-app and web push notifications keep their full task destination. Login waits
for session restoration and retains `/n/...` in `next`; password autofill is
explicitly enabled. Authentication persistence was already enabled.

Deploy the frontend resolver before applying the SQL migration. The migration
updates only unsent ready/missing-phone notices and the private capture helper;
it does not resend history or change consent, recipients or bridge limits.
Keep the existing Workers origin until a short custom domain is connected and
verified. The current improvement shortens the path, not the host.

An iPhone Home Screen PWA cannot guarantee interception of WhatsApp links.
Do not add fake app-opening buttons, tokenized auto-login URLs or cross-context
session copies. App web push remains the available way to open a task from an
OS notification in the installed PWA. Native Universal Links require an actual
native app and domain association.
