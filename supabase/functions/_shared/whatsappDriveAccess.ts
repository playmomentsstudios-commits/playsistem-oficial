// Read existing permissions only. Never grant access or publish a Drive file.
export async function inspectWhatsAppDriveAccess(
  file: { id: string; drive_file_id: string; drive_folder_id: string; name: string },
  token: string,
  fetchImpl: typeof fetch = fetch,
) {
  const params = new URLSearchParams({
    fields: 'id,name,parents,trashed,webViewLink,permissions(type,role,emailAddress,deleted,expirationTime)',
    supportsAllDrives: 'true',
  });
  const response = await fetchImpl(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.drive_file_id)}?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) return null;
  const item = await response.json();
  if (item.trashed || item.id !== file.drive_file_id || item.name !== file.name
      || !Array.isArray(item.parents) || !item.parents.includes(file.drive_folder_id)
      || !Array.isArray(item.permissions)) return null;
  const escapedId = file.drive_file_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (typeof item.webViewLink !== 'string'
      || !new RegExp(`^https://drive[.]google[.]com/file/d/${escapedId}/view([?][A-Za-z0-9_=&%-]*)?$`).test(item.webViewLink)) return null;
  const readable = item.permissions.filter((p: any) => !p.deleted
    && ['reader', 'commenter', 'writer', 'owner', 'organizer', 'fileOrganizer'].includes(p.role)
    && (!p.expirationTime || Date.parse(p.expirationTime) > Date.now() + 15 * 60 * 1000));
  return {
    file_id: file.id, drive_file_id: item.id, drive_folder_id: file.drive_folder_id,
    file_name: item.name, web_view_link: item.webViewLink,
    public_readable: readable.some((p: any) => p.type === 'anyone'),
    // Group and domain membership cannot be proved by this response: deny conservatively.
    reader_emails: [...new Set(readable.filter((p: any) => p.type === 'user' && typeof p.emailAddress === 'string')
      .map((p: any) => p.emailAddress.toLowerCase()))],
    checked_at: new Date().toISOString(),
  };
}
