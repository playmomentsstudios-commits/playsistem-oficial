# Sagamente: private chat attachments in Google Drive

The failure was binary response decoding, not only image weight: `functions.invoke` treats `image/jpeg`, `audio/*` and `video/*` responses as text. Rewrapping that string in a Blob replaces invalid UTF-8 bytes irreversibly. The project-file picker had therefore been uploading corrupted images to the chat. Both project and chat downloads now use authenticated `fetch` and `Response.blob()`.

## Implementation

- Upload directly to one scoped Drive resumable session in 5 MB chunks. OAuth credentials stay on the server.
- Reserve an immutable Drive ID per message; atomic session creation and retries prevent duplicates.
- Validate conversation permissions, name, MIME type, size, parent folder, message binding, SHA-256 and owner-only Drive permissions before allowing message insertion.
- Private folder tree starts in My Drive, avoiding inherited site/project sharing permissions.
- Chat thumbnails and enlarged previews use the same authenticated Google thumbnail architecture as project previews. No automatic heavy-original fallback. Previews remain below 3 MB by reducing resolution in a bounded sequence.
- Original audio, video, PDF and other downloads remain binary. Blob URLs are released when views close.
- Legacy reads remain compatible. The final Storage cutover removes only chat insert policies, retaining objects and read permissions.

## Live validation

Disposable customer, unrelated customer and administrator accounts exercised the real production Supabase functions and Drive, using the actual frontend API implementations. Tested customer and administrator uploads for JPEG, a 27,021,302-byte PNG, WAV, PDF, MP4 and UTF-8 document: 12 successful uploads. Downloads matched source SHA-256. Repeated uploads retained the same Drive ID; repeated sends retained the same message ID. Another customer received HTTP 403 and could not read the message through RLS. Persistence/reload and zero new Storage objects were checked.

The large PNG exposed an oversized enlarged thumbnail during validation. The bounded resizing fix yielded a valid 1024 × 1024 PNG of 2,836,246 bytes; its inline preview was 720 × 720 and 1,310,281 bytes. Pillow opened and verified both images. The disposable test harness initially assumed an empty conversation after an interrupted run; its reload assertion was corrected to verify all sent message IDs without assuming no prior test messages.

149 automated tests, TypeScript typecheck and production build passed locally. Deno typecheck passed with the pinned installed Supabase type declarations mapped locally because direct Deno dependency downloads are unavailable in this environment. GitHub CI validates the committed revision separately.

## Legacy migration

All 10 recorded legacy attachments were migrated and re-read with hash and size checks. Six images required recovery: a project original was accepted only when reproducing the previous text conversion produced the exact SHA-256 of the damaged chat object. Four other originals migrated unchanged. All seven image previews were validated. No missing or unresolved corrupt file remains. Detailed per-file IDs and hashes are kept in the private delivery report, not this public repository.

- Legacy chat Storage remains unchanged: 10 objects, 153,354,868 bytes.
- Active migrated Drive originals: 90,032,788 bytes.
- One damaged intermediate Drive archive was retained for provenance: 25,662,978 bytes.
- New attachment bytes written to Supabase Storage during live tests: zero.

## Remaining device validation

A physical iPhone/Safari, Android handset and Windows device were not used. Cloud Chrome opens the public production site; authenticated chat UI validation requires a secure browser session and was not claimed. Local Chromium/WebKit installation was unavailable because the download endpoint returned a non-browser payload. API integration and image-file decoding were verified, but hardware-specific interaction, native audio playback and download behavior remain device checks.

The security advisor reports existing unrelated project notices. The new server-only ledger/job tables intentionally deny anon/authenticated access through both grants and RLS; the privileged validation trigger is not callable by those roles. No Drive OAuth token or resumable-session URL is included in public report files.

## Release order

Deploy additive database rules and authenticated functions; validate/migrate originals; pass PR CI; merge main; confirm production frontend deployment; apply `chat_drive_storage_cutover`; verify Storage denial. Keep legacy objects until an explicitly authorized destructive cleanup.
