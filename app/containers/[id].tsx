import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { CameraView as CameraViewType } from 'expo-camera';
import { getContainer, type ContainerDetail } from '@/repositories/containerRepository';
import { initializeDatabase, getDatabase } from '@/database/database';
import { pickAndImportPhotos } from '@/foto/photoPicker';
import { FotoService } from '@/foto/fotoService';

export default function ContainerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [container, setContainer] = useState<ContainerDetail | null>(null);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const cameraRef = useRef<CameraViewType>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      await initializeDatabase();
      const detail = await getContainer(id);
      setContainer(detail);
      if (detail) {
        const db = await getDatabase();
        const service = new FotoService(db);
        const photos = await service.getPhotos({ type: 'CONTAINER', id });
        const uris = await Promise.all(photos.map((photo) => service.getPhotoUri(photo.id)));
        setPhotoUris(uris);
      } else {
        setPhotoUris([]);
      }
    } catch (error) {
      Alert.alert('Errore caricamento fotografie', error instanceof Error ? error.message : 'Impossibile caricare il contenitore.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  async function addPhotosFromGallery() {
    if (!id) return;
    try {
      const db = await getDatabase();
      const result = await pickAndImportPhotos(new FotoService(db), { type: 'CONTAINER', id });
      if (result.failures.length) {
        Alert.alert('Importazione parziale', `${result.imported.length} foto importate, ${result.failures.length} non importate.`);
      }
      await refresh();
    } catch (error) {
      Alert.alert('Importazione non riuscita', error instanceof Error ? error.message : 'Errore imprevisto.');
    }
  }

  async function openCamera() {
    try {
      const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert('Permesso fotocamera necessario', 'Per scattare una foto, consenti a ThingTrace di utilizzare la fotocamera.');
        return;
      }
      setCameraReady(false);
      setCameraOpen(true);
    } catch (error) {
      Alert.alert('Fotocamera non disponibile', error instanceof Error ? error.message : 'Impossibile aprire la fotocamera.');
    }
  }

  async function capturePhoto() {
    if (!id || !cameraRef.current || !cameraReady) return;
    try {
      const captured = await cameraRef.current.takePictureAsync({ quality: 0.9, exif: false });
      if (!captured?.uri) throw new Error('La fotocamera non ha restituito un file immagine.');
      const db = await getDatabase();
      await new FotoService(db).importPhoto({
        sourceUri: captured.uri,
        originalName: `thingtrace-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        width: captured.width,
        height: captured.height,
        entity: { type: 'CONTAINER', id },
      });
      setCameraOpen(false);
      await refresh();
    } catch (error) {
      Alert.alert('Scatto non riuscito', error instanceof Error ? error.message : 'Impossibile salvare la fotografia.');
    }
  }

  if (loading) return <View style={styles.center}><Text style={styles.muted}>Caricamento...</Text></View>;
  if (!container) return <View style={styles.center}><Text>Contenitore non trovato.</Text></View>;

  return (
    <>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.hero}>
          <Text style={styles.type}>{container.typeLabel.toUpperCase()}</Text>
          <Text style={styles.title}>{container.name}</Text>
          {container.notes ? <Text style={styles.notes}>{container.notes}</Text> : null}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Fotografie</Text>
          <Text style={styles.muted}>{photoUris.length}</Text>
        </View>

        {photoUris.length ? (
          <View style={styles.grid}>
            {photoUris.map((uri) => (
              <Pressable key={uri} onPress={() => setSelectedPhoto(uri)} accessibilityRole="imagebutton" accessibilityLabel="Apri fotografia">
                <Image
                  source={{ uri }}
                  style={styles.photo}
                  resizeMode="cover"
                  onError={(event) => {
                    Alert.alert('Immagine non visualizzabile', event.nativeEvent.error || `Impossibile leggere il file: ${uri}`);
                  }}
                />
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Non ci sono ancora fotografie associate a questo contenitore.</Text>
          </View>
        )}

        <Pressable style={styles.button} onPress={openCamera}>
          <Text style={styles.buttonText}>◎  Scatta una foto</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.secondaryButton]} onPress={addPhotosFromGallery}>
          <Text style={styles.secondaryButtonText}>＋  Scegli dalla galleria</Text>
        </Pressable>
        <Text style={styles.footnote}>Le fotografie scattate o selezionate vengono copiate nell'archivio privato di ThingTrace. Gli originali non vengono eliminati.</Text>
      </ScrollView>

      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <View style={styles.cameraScreen}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            onCameraReady={() => setCameraReady(true)}
          />
          <View style={styles.cameraControls}>
            <Pressable style={styles.cameraCancel} onPress={() => setCameraOpen(false)}>
              <Text style={styles.cameraCancelText}>Annulla</Text>
            </Pressable>
            <Pressable
              style={[styles.shutter, !cameraReady && styles.shutterDisabled]}
              onPress={capturePhoto}
              disabled={!cameraReady}
              accessibilityRole="button"
              accessibilityLabel="Scatta fotografia"
            >
              <View style={styles.shutterInner} />
            </Pressable>
            <View style={styles.cameraSideSpacer} />
          </View>
          {!cameraReady ? <Text style={styles.cameraHint}>Preparazione fotocamera...</Text> : null}
        </View>
      </Modal>

      <Modal visible={selectedPhoto !== null} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
        <View style={styles.viewer}>
          <Pressable style={styles.viewerClose} onPress={() => setSelectedPhoto(null)}>
            <Text style={styles.viewerCloseText}>Chiudi</Text>
          </Pressable>
          {selectedPhoto ? <Image source={{ uri: selectedPhoto }} style={styles.fullPhoto} resizeMode="contain" /> : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 22, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#7D8377' },
  hero: { backgroundColor: '#E9E5D9', borderRadius: 20, padding: 22, marginBottom: 26 },
  type: { color: '#68715E', fontSize: 10, letterSpacing: 1.4, fontWeight: '800', marginBottom: 8 },
  title: { fontSize: 27, fontWeight: '800', color: '#252923' },
  notes: { color: '#5E6258', lineHeight: 21, marginTop: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { flex: 1, color: '#252923', fontSize: 20, fontWeight: '800' },
  empty: { padding: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E1DFD7', borderRadius: 16 },
  emptyText: { color: '#777D72', textAlign: 'center', lineHeight: 21 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: 104, height: 104, borderRadius: 12, backgroundColor: '#E9E8E1' },
  button: { backgroundColor: '#43533C', borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 14 },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  secondaryButton: { backgroundColor: '#EEF0E8', marginTop: 10 },
  secondaryButtonText: { color: '#43533C', fontWeight: '800', fontSize: 15 },
  footnote: { color: '#858A80', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 14 },
  cameraScreen: { flex: 1, backgroundColor: '#000000', justifyContent: 'flex-end' },
  camera: { ...StyleSheet.absoluteFillObject },
  cameraControls: { minHeight: 120, paddingHorizontal: 28, paddingBottom: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cameraCancel: { minWidth: 76, paddingVertical: 12 },
  cameraCancelText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutterDisabled: { opacity: 0.4 },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF' },
  cameraSideSpacer: { width: 76 },
  cameraHint: { position: 'absolute', alignSelf: 'center', bottom: 150, color: '#FFFFFF' },
  viewer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  viewerClose: { position: 'absolute', zIndex: 1, top: 54, right: 22, padding: 12 },
  viewerCloseText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  fullPhoto: { width: '100%', height: '82%' },
});
