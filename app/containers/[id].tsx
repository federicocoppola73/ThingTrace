import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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
import { listItems, type ItemSummary } from '@/repositories/itemRepository';
import { initializeDatabase, getDatabase } from '@/database/database';
import { pickAndImportPhotos } from '@/foto/photoPicker';
import { FotoService } from '@/foto/fotoService';

export default function ContainerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [container, setContainer] = useState<ContainerDetail | null>(null);
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [photoRecords, setPhotoRecords] = useState<import('@/foto/types').PhotoRecord[]>([]);
  const [photoUris, setPhotoUris] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<import('@/foto/types').PhotoRecord | null>(null);
  const cameraRef = useRef<CameraViewType | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      await initializeDatabase();
      const [detail, allItems] = await Promise.all([getContainer(id), listItems()]);
      setContainer(detail);
      setItems(allItems.filter((item) => item.currentContainerId === id));
      if (detail) {
        const db = await getDatabase();
        const service = new FotoService(db);
        const photos = await service.getPhotos({ type: 'CONTAINER', id });
        const uris = await Promise.all(photos.map(async (photo) => [photo.id, await service.getPhotoUri(photo.id)] as const));
        setPhotoRecords(photos);
        setPhotoUris(Object.fromEntries(uris));
      } else {
        setItems([]);
        setPhotoRecords([]);
        setPhotoUris({});
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

  function movePhotoToTrash(photo: import('@/foto/types').PhotoRecord) {
    Alert.alert('Spostare nel cestino?', 'La fotografia verrà rimossa dal contenitore e spostata nel cestino. Potrai ripristinarla o eliminarla definitivamente in seguito.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Sposta nel cestino', style: 'destructive', onPress: async () => {
        try { await new FotoService(await getDatabase()).moveToTrash(photo.id); setSelectedPhoto(null); await refresh(); }
        catch (error) { Alert.alert('Operazione non riuscita', error instanceof Error ? error.message : 'Impossibile spostare la foto nel cestino.'); }
      } },
    ]);
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
          {container.locationName ? <Text style={styles.notes}>⌖  {container.locationName}</Text> : <Text style={styles.locationMissing}>Ubicazione non assegnata</Text>}
          {container.notes ? <Text style={styles.notes}>{container.notes}</Text> : null}
          <Pressable style={styles.editButton} onPress={() => router.push({ pathname: '/containers/edit', params: { id: container.id } })}>
            <Text style={styles.editButtonText}>Modifica contenitore</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Oggetti</Text>
          <Text style={styles.muted}>{items.length}</Text>
          <Pressable
            style={styles.addItemButton}
            onPress={() => router.push({ pathname: '/items/new', params: { containerId: container.id } })}
          >
            <Text style={styles.addItemButtonText}>＋ Aggiungi</Text>
          </Pressable>
        </View>

        {items.length ? (
          <View style={styles.itemList}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                style={styles.itemCard}
                onPress={() => router.push({ pathname: '/items/[id]', params: { id: item.id } })}
                accessibilityRole="button"
                accessibilityLabel={`Apri ${item.name}`}
              >
                <View style={styles.itemCardText}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.description ? <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text> : null}
                </View>
                <Text style={styles.itemQuantity}>× {item.quantity}</Text>
                <Text style={styles.itemChevron}>›</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nessun oggetto è attualmente associato a questo contenitore.</Text>
            <Text style={styles.emptyText}>Puoi aggiungerne uno con il pulsante qui sopra.</Text>
          </View>
        )}

        <View style={[styles.sectionHeader, { marginTop: 28 }]}>
          <Text style={styles.sectionTitle}>Fotografie</Text>
          <Text style={styles.muted}>{photoRecords.length}</Text>
        </View>

        {photoRecords.length ? (
          <View style={styles.grid}>
            {photoRecords.map((photo) => (
              <View key={photo.id} style={styles.photoWrap}><Pressable onPress={() => setSelectedPhoto(photo)} accessibilityRole="imagebutton" accessibilityLabel="Apri fotografia">
                <Image
                  source={{ uri: photoUris[photo.id] }}
                  style={styles.photo}
                  resizeMode="cover"
                  onError={(event) => {
                    Alert.alert('Immagine non visualizzabile', event.nativeEvent.error || `Impossibile leggere il file: ${photoUris[photo.id]}`);
                  }}
                />
              </Pressable><Pressable style={styles.photoDelete} onPress={() => movePhotoToTrash(photo)}><Text style={styles.photoDeleteText}>×</Text></Pressable></View>
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
        <Pressable style={[styles.button, styles.secondaryButton]} onPress={() => router.push('/trash')}><Text style={styles.secondaryButtonText}>▤  Apri cestino</Text></Pressable>
        <Text style={styles.footnote}>Le fotografie scattate o selezionate vengono copiate nell'archivio privato di ThingTrace. Gli originali non vengono eliminati.</Text>
      </ScrollView>

      <Modal visible={cameraOpen} animationType="slide" hardwareAccelerated onRequestClose={() => setCameraOpen(false)}>
        <View style={styles.cameraScreen}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            active={cameraOpen}
            onCameraReady={() => setCameraReady(true)}
            onMountError={(event) => {
              setCameraReady(false);
              Alert.alert('Errore fotocamera', event.message || 'La fotocamera non è riuscita ad avviare l’anteprima.');
            }}
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
          {selectedPhoto ? <Image source={{ uri: photoUris[selectedPhoto.id] }} style={styles.fullPhoto} resizeMode="contain" /> : null}
          {selectedPhoto ? <Pressable style={styles.viewerDelete} onPress={() => movePhotoToTrash(selectedPhoto)}><Text style={styles.viewerDeleteText}>Sposta nel cestino</Text></Pressable> : null}
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
  locationMissing: { color: '#858A80', fontSize: 12, marginTop: 9 },
  editButton: { alignSelf: 'flex-start', marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10 },
  editButtonText: { color: '#43533C', fontWeight: '800', fontSize: 13 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { flex: 1, color: '#252923', fontSize: 20, fontWeight: '800' },
  addItemButton: { backgroundColor: '#43533C', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginLeft: 10 },
  addItemButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  itemList: { gap: 9 },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 13, borderWidth: 1, borderColor: '#ECEAE3', padding: 15, gap: 10 },
  itemCardText: { flex: 1 },
  itemName: { color: '#252923', fontSize: 15, fontWeight: '800' },
  itemDescription: { color: '#777D72', fontSize: 12, marginTop: 4, lineHeight: 17 },
  itemQuantity: { color: '#59634F', fontSize: 13, fontWeight: '800' },
  itemChevron: { color: '#858A80', fontSize: 24, marginLeft: 2 },
  empty: { padding: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E1DFD7', borderRadius: 16 },
  emptyText: { color: '#777D72', textAlign: 'center', lineHeight: 21 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: 104, height: 104, borderRadius: 12, backgroundColor: '#E9E8E1' },
  photoWrap: { position: 'relative' }, photoDelete: { position: 'absolute', top: 4, right: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: '#252923', alignItems: 'center', justifyContent: 'center' }, photoDeleteText: { color: '#FFFFFF', fontSize: 20, lineHeight: 23 },
  button: { backgroundColor: '#43533C', borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 14 },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  secondaryButton: { backgroundColor: '#EEF0E8', marginTop: 10 },
  secondaryButtonText: { color: '#43533C', fontWeight: '800', fontSize: 15 },
  footnote: { color: '#858A80', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 14 },
  cameraScreen: { flex: 1, backgroundColor: '#000000', justifyContent: 'flex-end' },
  camera: { flex: 1, width: '100%' },
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
  fullPhoto: { width: '100%', height: '75%' }, viewerDelete: { position: 'absolute', bottom: 42, padding: 14 }, viewerDeleteText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
