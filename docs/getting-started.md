# Avvio locale di ThingTrace

## Requisiti

- Node.js 22.13 o successivo (richiesto da Expo SDK 58).
- npm.
- Android Studio per emulatore Android oppure un dispositivo Android.
- macOS e Xcode per build e simulatore iOS.

## Installazione

Dalla cartella principale del repository:

```bash
npm install
npx expo install --fix
npx expo-doctor
```

Avvio del bundler:

```bash
npx expo start
```

Per una build nativa locale:

```bash
npx expo run:android
npx expo run:ios
```

Il comando iOS richiede macOS e Xcode. Per lo sviluppo con moduli nativi si consiglia una development build.

## Primo flusso disponibile

1. Aprire ThingTrace.
2. Toccare **Crea contenitore**.
3. Inserire un nome e scegliere il tipo.
4. Aprire il contenitore creato.
5. Toccare **Aggiungi fotografie**.
6. Selezionare una o più immagini: ThingTrace le copia nella propria directory privata e registra i metadati in SQLite.

## Stato e limiti

Questa è una prima base di avvio, non una release pronta per gli store. Il flusso contenitore/foto è implementato a livello sorgente ma deve ancora essere verificato con installazione dipendenze, TypeScript, Expo Doctor e prove su dispositivi Android/iOS.

Le tabelle homes e locations sono predisposte ma la relativa interfaccia e la selezione della posizione non sono ancora implementate. La generazione e la scansione QR, il cestino visuale, le miniature e il backup completo sono milestone successive.
