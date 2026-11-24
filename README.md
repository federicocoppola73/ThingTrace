# ThingTrace

ThingTrace is an offline-first inventory and archive app for physical containers, objects and digital documents.

## Current development status

The repository is being initialized. The first implementation milestone is the local photo archive module.

## Technical baseline

- TypeScript
- React Native
- Expo SDK 58
- expo-sqlite for relational metadata
- expo-file-system for app-private file storage
- expo-image-picker for photo import
- expo-camera for in-app capture and QR scanning

## Photo archive design

Photos are copied into ThingTrace's private document storage. The original in the device gallery is never modified or deleted. SQLite stores metadata and relationships; image bytes are stored as files, not BLOBs.

See [Photo module design](docs/photo-module.md).

## Important

This repository currently contains the photo module foundation and its database migration. It is not yet a complete runnable Expo application. The app scaffold, entity schema (`containers`, `items`, `documents`), UI and automated device tests are subsequent milestones.