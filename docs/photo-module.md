# ThingTrace — Photo archive module

## Functional contract

- Import from the system photo picker or capture with the camera.
- Copy each selected image into app-private persistent storage before creating its SQLite record.
- Never modify or delete the original gallery asset.
- A photo has one UUID and one stored file; it may be linked to multiple containers, items or documents.
- Removing a link does not delete the photo.
- Moving a photo to the in-app trash is a soft delete; links are retained so restore can recover the original associations.
- Permanent deletion is allowed only for a photo already in the trash.
- Backups must include the SQLite database and every referenced photo file.

## Storage layout

Files are stored relative to the app document directory:

```text
files/
  photos/
    <photo-uuid>/
      original.<extension>
```

The database stores relative paths only. It must never store cache URIs or absolute device paths.

## Data model

`photos` stores metadata. `container_photos`, `item_photos` and `document_photos` are typed join tables with real foreign keys. A photo can be linked to multiple entities without duplicating its bytes.

Soft-deleted photos retain their join rows. All normal queries must filter `photos.deleted_at IS NULL`.

## Import sequence

1. Validate the source URI and supported image MIME type.
2. Generate a UUID and a safe extension.
3. Copy the source into the app document directory.
4. Verify destination existence and non-zero size.
5. Insert metadata and optional entity link in one SQLite transaction.
6. If the transaction fails, remove the copied file.

Filesystem operations and SQLite transactions cannot be atomic together. A future integrity scan must detect orphan files and database rows whose files are missing.

## Integrity and privacy

- Original image bytes are preserved; do not recompress the source during import.
- Thumbnails are derived cache files and can be regenerated.
- Do not expose private photo paths outside the photo module.
- The original may contain EXIF metadata, including location. ThingTrace does not display GPS metadata in the MVP.
- The app-private directory is not a backup. Device loss or app removal can still cause data loss.
- SHA-256 is calculated on the archived copy during import with `File.digest('SHA-256')`. Backup export/import must verify the stored checksum and may recalculate it.

## Current implementation boundary

This module assumes the parent schema already defines `containers(id)`, `items(id)` and `documents(id)`. The app scaffold, those entity tables, UI, thumbnail generation, camera capture integration, backup integration and device-level tests are not yet implemented.

## Expo APIs

Use the current `expo-file-system` object API (`File`, `Directory`, `Paths`) rather than deprecated legacy calls. Install native dependencies with `npx expo install` against the Expo SDK selected by the app.