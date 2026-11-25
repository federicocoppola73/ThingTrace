# ThingTrace

ThingTrace is an offline-first inventory and archive app for physical containers, objects and digital documents.

## Current development status

The repository now includes an Expo SDK 58 application scaffold and the first end-to-end source flow: create a container, select photos, copy them to private app storage and display them from the archive. Device installation and runtime validation are still pending.

## Technical baseline

- TypeScript
- React Native
- Expo SDK 58
- `expo-sqlite` for relational metadata
- `expo-file-system` for app-private file storage
- `expo-image-picker` for photo import
- `expo-document-picker` for PDF and file import
- `expo-camera` for in-app camera capture and QR scanning
- `expo-crypto` for UUID generation

## Location management

- Hierarchical locations: site → room/zone → place → position.
- Assign a location when creating or editing a container.
- Search containers by their full location path.
- Cascading deletion removes a whole site or location subtree; confirmation reports affected locations and containers. Containers and photos are preserved and become unassigned.
- See `docs/locations.md` for the data model and workflows.

## Item inventory and movement history

- Create, edit, search and inspect items with quantity, description, notes and optional container or direct location assignment.
- Attach photos to items using the same private archive as container photos, including camera capture and gallery import.
- Move items between containers, direct locations or unassigned; every actual change is recorded transactionally in `item_movements`.
- Movement records preserve the source/destination container names as snapshots, even if a container is later deleted.
- See `docs/items.md` for the data model and movement semantics.

## Document archive

- Independent document records with title, category, description, date, number, issuer, optional expiry and notes.
- Multiple PDF/image/file attachments copied to private app storage with SHA-256 checksums.
- Reusable links from documents to items, containers and locations; linking does not duplicate the document or its attachments.
- Central search, document detail/edit, native attachment preview and contextual create/link flows.
- See `docs/documents.md` for the data model and workflows.

## Photo archive module

- `src/foto/fotoService.ts`: application-facing photo operations.
- `src/foto/photoRepository.ts`: SQLite metadata and relationship access.
- `src/foto/photoStorage.ts`: private file copy, lookup, digest and deletion.
- `src/foto/photoPicker.ts`: multi-image picker adapter; imports are processed sequentially.
- `src/foto/types.ts`: public types and typed errors.
- `src/database/migrations/001_create_photos.sql`: reference SQL migration.
- `src/database/runPhotoMigration.ts`: runtime migration helper.
- `docs/photo-module.md`: functional and technical design.

Photos are copied into the app's private document storage. The original gallery asset is never modified or deleted. Image bytes are stored as files, not SQLite BLOBs. SHA-256 is calculated on the archived copy using the Expo FileSystem API.

## Integration prerequisites

The photo migration requires the parent tables `containers`, `items` and `documents` to exist first. Call `runPhotoMigration(db)` after those tables have been created. Then construct `new FotoService(db)` and use `pickAndImportPhotos(service, { type: 'CONTAINER', id: containerId })` from a user interaction.

Install Expo-compatible native dependencies from the app root with `npx expo install expo-sqlite expo-file-system expo-crypto expo-image-picker expo-camera` after the Expo app scaffold is created.

## Not implemented yet

- Device-verified dependency installation and native builds.
- Additional document features such as expiry reminders, OCR and document versioning.
- QR scanning UI.
- Thumbnail generation and photo gallery components.
- Backup/restore integration.
- Automated TypeScript, unit and Android/iOS device tests.

QR workflows, backup/restore, expiry reminders/OCR, thumbnail processing and automated device tests are subsequent milestones. The current branch is an initial development build, not a tested release.