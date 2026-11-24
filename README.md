# ThingTrace

ThingTrace is an offline-first inventory and archive app for physical containers, objects and digital documents.

## Current development status

The repository has been initialized with the first implementation slice: the local photo archive module. The repository is not yet a complete runnable Expo application.

## Technical baseline

- TypeScript
- React Native
- Expo SDK 58
- `expo-sqlite` for relational metadata
- `expo-file-system` for app-private file storage
- `expo-image-picker` for photo import
- `expo-camera` for in-app camera capture and QR scanning
- `expo-crypto` for UUID generation

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

- Expo application scaffold and package manifest.
- Core entity schema and migrations for containers, items and documents.
- Camera screen integration and QR scanning UI.
- Thumbnail generation and photo gallery components.
- Backup/restore integration.
- Automated TypeScript, unit and Android/iOS device tests.

These are explicit next milestones; the current repository contents should be treated as the photo module foundation, not as a tested release.