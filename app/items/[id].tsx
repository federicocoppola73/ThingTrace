import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { CameraView as CameraViewType } from 'expo-camera';
import { deleteItem, getItem, listItemMovements, moveItem, type ItemDestination, type ItemMovement, type ItemSummary } from '@/repositories/itemRepository';
import { listContainers, type ContainerSummary } from '@/repositories/containerRepository';
import { listLocations, type LocationRecord } from '@/repositories/locationRepository';
import { ContainerPicker } from '@/components/ContainerPicker';
import { getDatabase } from '@/database/database';
import { FotoService } from '@/foto/fotoService';
import { pickAndImportPhotos } from '@/foto/photoPicker';
import type { PhotoRecord } from '@/foto/types';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<ItemSummary | null>(null);
  const [movements, setMovements] = useState<ItemMovement[]>([]);
  const [containers, setContainers] = useState<ContainerSummary[]>([]);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [photoUris, setPhotoUris] = useState<Record<string, string>>({});
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [moveOpen, setMoveOpen] = useState(false);
  const [destination, setDestination] = useState<ItemDestination>({ kind: 'none', id: null });
  const [movementNote, setMovementNote] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef<CameraViewType | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [record, history, containerRows, locationRows] = await Promise.all([getItem(id), listItemMovements(id), listContainers(), listLocations()]);
      setItem(record); setMovements(history); setContainers(containerRows); setLocations(locationRows);
      if (record) {
        const service = new FotoService(await getDatabase());
        const records = await service.getPhotos({ type: 'ITEM', id });
        const uris = await Promise.all(records.map(async (photo) => [photo.id, await service.getPhotoUri(photo.id)] as const));
        setPhotos(records); setPhotoUris(Object.fromEntries(uris));
      } else { setPhotos([]); setPhotoUris({}); }
    } catch (error) { Alert.alert('Errore caricamento oggetto', error instanceof Error ? error.message : 'Impossibile caricare i dati.'); }
    finally { setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  function openMove() {
    setDestination(item?.currentContainerId ? { kind: 'container', id: item.currentContainerId } : item?.currentLocationId ? { kind: 'location', id: item.currentLocationId } : { kind: 'none', id: null });
    setMovementNote('');
    setMoveOpen(true);
  }
  function destinationText(value: ItemDestination) {
    if (value.kind === 'none') return 'Non assegnato';
    if (value.kind === 'container') return containers.find((row) => row.id === value.id)?.name ?? 'Contenitore selezionato';
    const place = locations.find((row) => row.id === value.id);
    return place ? place.homeName + ' · ' + place.path : 'Ubicazione selezionata';
  }
  async function saveMove() {
    if (!id) return;
    try { await moveItem(id, destination, movementNote); setMoveOpen(false); await refresh(); }
    catch (error) { Alert.alert('Spostamento non riuscito', error instanceof Error ? error.message : 'Impossibile spostare l’oggetto.'); }
  }
  function confirmMove() {
    const current: ItemDestination = item.currentContainerId ? { kind: 'container', id: item.currentContainerId } : item.currentLocationId ? { kind: 'location', id: item.currentLocationId } : { kind: 'none', id: null };
    Alert.alert('Confermare lo spostamento?', destinationText(current) + '  →  ' + destinationText(destination), [
      { text: 'Annulla', style: 'cancel' }, { text: 'Conferma', onPress: () => { void saveMove(); } },
    ]);
  }
  function confirmUnassign() {
    if (!id || (!item.currentContainerId && !item.currentLocationId)) return;
    const current = item.currentContainerName ?? item.currentLocationName ?? 'collocazione attuale';
    Alert.alert('Rimuovere la collocazione?', 'L’oggetto verrà disassociato da ' + current + ' e resterà nell’inventario come non assegnato.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Rimuovi', style: 'destructive', onPress: async () => {
        try { await moveItem(id, { kind: 'none', id: null }, 'Rimosso dalla collocazione'); await refresh(); }
        catch (error) { Alert.alert('Operazione non riuscita', error instanceof Error ? error.message : 'Impossibile rimuovere la collocazione.'); }
      } },
    ]);
  }
  function confirmDeleteItem() {
    if (!id || !item) return;
    Alert.alert(
      'Eliminare questo oggetto?',
      'L’oggetto, il suo storico e le fotografie associate esclusivamente a esso verranno eliminati definitivamente. Le foto eventualmente condivise con altre entità resteranno disponibili per quelle entità. Questa operazione non è annullabile.',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina oggetto', style: 'destructive', onPress: async () => {
          try {
            await new FotoService(await getDatabase()).deleteEntityPhotos({ type: 'ITEM', id });
            await deleteItem(id);
            router.replace('/items');
          } catch (error) {
            Alert.alert('Eliminazione non riuscita', error instanceof Error ? error.message : 'Impossibile eliminare l’oggetto.');
          }
        } },
      ]
    );
  }
  async function addPhotos() {
    if (!id) return;
    try {
      const result = await pickAndImportPhotos(new FotoService(await getDatabase()), { type: 'ITEM', id });
      if (result.failures.length) Alert.alert('Importazione parziale', result.imported.length + ' foto importate, ' + result.failures.length + ' non importate.');
      await refresh();
    } catch (error) { Alert.alert('Importazione non riuscita', error instanceof Error ? error.message : 'Errore imprevisto.'); }
  }
  async function openCamera() {
    try {
      const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
      if (!permission.granted) { Alert.alert('Permesso fotocamera necessario', 'Consenti a ThingTrace di utilizzare la fotocamera.'); return; }
      setCameraReady(false); setCameraOpen(true);
    } catch (error) { Alert.alert('Fotocamera non disponibile', error instanceof Error ? error.message : 'Impossibile aprire la fotocamera.'); }
  }
  async function capturePhoto() {
    if (!id || !cameraRef.current || !cameraReady) return;
    try {
      const captured = await cameraRef.current.takePictureAsync({ quality: 0.9, exif: false });
      if (!captured?.uri) throw new Error('La fotocamera non ha restituito un file immagine.');
      await new FotoService(await getDatabase()).importPhoto({
        sourceUri: captured.uri, originalName: 'thingtrace-item-' + Date.now() + '.jpg',
        mimeType: 'image/jpeg', width: captured.width, height: captured.height,
        entity: { type: 'ITEM', id },
      });
      setCameraOpen(false); await refresh();
    } catch (error) { Alert.alert('Scatto non riuscito', error instanceof Error ? error.message : 'Impossibile salvare la fotografia.'); }
  }
  function trashPhoto(photo: PhotoRecord) {
    Alert.alert('Spostare nel cestino?', 'La fotografia verrà spostata nel cestino e potrà essere ripristinata.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Sposta nel cestino', style: 'destructive', onPress: async () => {
        try { await new FotoService(await getDatabase()).moveToTrash(photo.id); setSelectedPhoto(null); await refresh(); }
        catch (error) { Alert.alert('Operazione non riuscita', error instanceof Error ? error.message : 'Impossibile spostare la foto.'); }
      } },
    ]);
  }
  const dateLabel = (value: string) => new Date(value).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
  if (loading) return <View style={styles.center}><Text style={styles.muted}>Caricamento...</Text></View>;
  if (!item) return <View style={styles.center}><Text>Oggetto non trovato.</Text></View>;

  return (
    <>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>OGGETTO</Text>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.quantity}>Quantità: {item.quantity}</Text>
          <Text style={styles.location}>{item.currentContainerName ? 'Contenitore: ' + item.currentContainerName : item.currentLocationName ? 'Ubicazione: ' + item.currentLocationName : 'Non assegnato'}</Text>
          {(item.currentContainerId || item.currentLocationId) ? <View style={styles.locationActions}>
            <Pressable style={styles.moveButton} onPress={openMove}><Text style={styles.moveText}>Sposta</Text></Pressable>
            <Pressable style={styles.disassociateButton} onPress={confirmUnassign}><Text style={styles.disassociateText}>Rimuovi</Text></Pressable>
          </View> : <Pressable style={[styles.moveButton, { alignSelf: 'flex-start', marginTop: 12 }]} onPress={openMove}><Text style={styles.moveText}>Assegna collocazione</Text></Pressable>}
          {item.description ? <Text style={styles.body}>{item.description}</Text> : null}
          {item.notes ? <Text style={styles.body}>{item.notes}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={styles.editButton} onPress={() => router.push({ pathname: '/items/edit', params: { id: item.id } })}><Text style={styles.editText}>Modifica oggetto</Text></Pressable>
            <Pressable style={styles.deleteItemButton} onPress={confirmDeleteItem}><Text style={styles.deleteItemText}>Elimina</Text></Pressable>
          </View>
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Fotografie</Text><Text style={styles.muted}>{photos.length}</Text></View>
        {photos.length ? <View style={styles.grid}>{photos.map((photo) => (
          <View key={photo.id} style={styles.photoWrap}>
            <Pressable onPress={() => setSelectedPhoto(photo)}><Image source={{ uri: photoUris[photo.id] }} style={styles.photo} resizeMode="cover" onError={(event) => Alert.alert('Immagine non visualizzabile', event.nativeEvent.error)} /></Pressable>
            <Pressable style={styles.photoDelete} onPress={() => trashPhoto(photo)}><Text style={styles.photoDeleteText}>×</Text></Pressable>
          </View>
        ))}</View> : <View style={styles.empty}><Text style={styles.emptyText}>Non ci sono ancora fotografie associate a questo oggetto.</Text></View>}
        <Pressable style={styles.button} onPress={openCamera}><Text style={styles.buttonText}>◎  Scatta una foto</Text></Pressable>
        <Pressable style={[styles.button, styles.secondaryButton]} onPress={addPhotos}><Text style={styles.secondaryText}>＋  Scegli dalla galleria</Text></Pressable>

        <View style={[styles.sectionHeader, { marginTop: 30 }]}><Text style={styles.sectionTitle}>Storico spostamenti</Text><Text style={styles.muted}>{movements.length}</Text></View>
        {movements.length ? movements.map((movement) => (
          <View key={movement.id} style={styles.historyCard}>
            <Text style={styles.historyDate}>{dateLabel(movement.movedAt)}</Text>
            <Text style={styles.historyRoute}>{movement.fromContainerName ?? movement.fromLocationName ?? 'Non assegnato'}  →  {movement.toContainerName ?? movement.toLocationName ?? 'Non assegnato'}</Text>
            {movement.note ? <Text style={styles.historyNote}>{movement.note}</Text> : null}
          </View>
        )) : <View style={styles.empty}><Text style={styles.emptyText}>Nessuno spostamento registrato. Il primo verrà aggiunto quando assegnerai una collocazione.</Text></View>}
        <Text style={styles.footnote}>Lo storico conserva i nomi delle collocazioni anche se contenitori o ubicazioni vengono successivamente eliminati.</Text>
      </ScrollView>

      <Modal visible={moveOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMoveOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.modalPage} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text style={styles.modalTitle}>Sposta oggetto</Text>
          <Text style={styles.modalHint}>Collocazione attuale: {item.currentContainerName ?? item.currentLocationName ?? 'Non assegnato'}. Seleziona la nuova destinazione.</Text>
          <Text style={styles.label}>NUOVA COLLOCAZIONE</Text>
          <ContainerPicker containers={containers} locations={locations} selected={destination} onSelect={setDestination} />
          <Text style={styles.label}>NOTA SULLO SPOSTAMENTO (FACOLTATIVA)</Text>
          <TextInput value={movementNote} onChangeText={setMovementNote} placeholder="Es. Trasferito dopo il trasloco..." style={styles.noteInput} multiline />
          <Pressable style={styles.button} onPress={confirmMove}><Text style={styles.buttonText}>Conferma spostamento</Text></Pressable>
          <Pressable style={styles.cancelButton} onPress={() => setMoveOpen(false)}><Text style={styles.cancelText}>Annulla</Text></Pressable>
        </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={cameraOpen} animationType="slide" hardwareAccelerated onRequestClose={() => setCameraOpen(false)}>
        <View style={styles.cameraScreen}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" active={cameraOpen} onCameraReady={() => setCameraReady(true)} onMountError={(event) => { setCameraReady(false); Alert.alert('Errore fotocamera', event.message); }} />
          <View style={styles.cameraControls}>
            <Pressable style={styles.cameraCancel} onPress={() => setCameraOpen(false)}><Text style={styles.cameraCancelText}>Annulla</Text></Pressable>
            <Pressable style={[styles.shutter, !cameraReady && styles.shutterDisabled]} onPress={capturePhoto} disabled={!cameraReady}><View style={styles.shutterInner} /></Pressable>
            <View style={{ width: 76 }} />
          </View>
          {!cameraReady ? <Text style={styles.cameraHint}>Preparazione fotocamera...</Text> : null}
        </View>
      </Modal>

      <Modal visible={selectedPhoto !== null} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
        <View style={styles.viewer}>
          <Pressable style={styles.viewerClose} onPress={() => setSelectedPhoto(null)}><Text style={styles.viewerCloseText}>Chiudi</Text></Pressable>
          {selectedPhoto ? <Image source={{ uri: photoUris[selectedPhoto.id] }} style={styles.fullPhoto} resizeMode="contain" /> : null}
          {selectedPhoto ? <Pressable style={styles.viewerDelete} onPress={() => trashPhoto(selectedPhoto)}><Text style={styles.viewerDeleteText}>Sposta nel cestino</Text></Pressable> : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 22, paddingBottom: 42 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#7D8377' }, hero: { backgroundColor: '#E9E5D9', borderRadius: 20, padding: 22, marginBottom: 26 },
  eyebrow: { color: '#68715E', fontSize: 10, letterSpacing: 1.4, fontWeight: '800', marginBottom: 8 },
  title: { fontSize: 27, fontWeight: '800', color: '#252923' }, quantity: { color: '#43533C', fontWeight: '800', marginTop: 10 },
  location: { color: '#5E6258', marginTop: 7, lineHeight: 20 }, body: { color: '#5E6258', lineHeight: 21, marginTop: 12 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 18 }, locationActions: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' }, editButton: { backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11 },
  editText: { color: '#43533C', fontWeight: '800', fontSize: 13 }, moveButton: { backgroundColor: '#43533C', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 },
  moveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  deleteItemButton: { backgroundColor: '#F6E9E6', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11 },
  deleteItemText: { color: '#9A4137', fontWeight: '800', fontSize: 13 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { flex: 1, color: '#252923', fontSize: 20, fontWeight: '800' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoWrap: { position: 'relative' }, photo: { width: 104, height: 104, borderRadius: 12, backgroundColor: '#E9E8E1' },
  photoDelete: { position: 'absolute', top: 4, right: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: '#252923', alignItems: 'center', justifyContent: 'center' },
  photoDeleteText: { color: '#FFFFFF', fontSize: 20, lineHeight: 23 }, empty: { padding: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E1DFD7', borderRadius: 16 },
  emptyText: { color: '#777D72', textAlign: 'center', lineHeight: 21 }, button: { backgroundColor: '#43533C', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 13 },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 }, secondaryButton: { backgroundColor: '#EEF0E8', marginTop: 9 },
  secondaryText: { color: '#43533C', fontWeight: '800', fontSize: 15 }, historyCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#ECEAE3', padding: 15, marginBottom: 9 },
  historyDate: { color: '#81867C', fontSize: 12, fontWeight: '700' }, historyRoute: { color: '#2A2F28', fontWeight: '800', marginTop: 7, lineHeight: 21 },
  historyNote: { color: '#777D72', marginTop: 6, lineHeight: 19 }, footnote: { color: '#858A80', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 14 },
  modalPage: { padding: 22, paddingTop: 28, paddingBottom: 40 }, modalTitle: { color: '#252923', fontSize: 24, fontWeight: '800' },
  modalHint: { color: '#777D72', lineHeight: 20, marginTop: 8, marginBottom: 17 }, containerOption: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E2DA', borderRadius: 12, padding: 13, marginBottom: 8 },
  containerSelected: { backgroundColor: '#E8EDE3', borderColor: '#64765A' }, containerOptionText: { color: '#545B4E', fontWeight: '700' },
  containerSelectedText: { color: '#35472F', fontWeight: '800' }, containerMeta: { color: '#858A80', fontSize: 12, marginTop: 4 },
  label: { fontSize: 11, letterSpacing: 1.1, fontWeight: '800', color: '#747A6E', marginBottom: 9, marginTop: 16 },
  noteInput: { backgroundColor: '#FFFFFF', borderColor: '#E4E2DA', borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 76, textAlignVertical: 'top', color: '#252923' },
  disassociateButton: { marginTop: 12, padding: 14, borderRadius: 11, backgroundColor: '#F7EAE7', alignItems: 'center' },
  disassociateText: { color: '#9A4137', fontWeight: '800' },
  unassignedHint: { color: '#68715E', marginTop: 10, fontSize: 13, textAlign: 'center' },
  cancelButton: { alignItems: 'center', padding: 15, marginTop: 4 }, cancelText: { color: '#59634F', fontWeight: '800' },
  cameraScreen: { flex: 1, backgroundColor: '#000000', justifyContent: 'flex-end' }, camera: { flex: 1, width: '100%' },
  cameraControls: { minHeight: 120, paddingHorizontal: 28, paddingBottom: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cameraCancel: { minWidth: 76, paddingVertical: 12 }, cameraCancelText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutterDisabled: { opacity: 0.4 }, shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF' },
  cameraHint: { position: 'absolute', alignSelf: 'center', bottom: 150, color: '#FFFFFF' },
  viewer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  viewerClose: { position: 'absolute', zIndex: 1, top: 54, right: 22, padding: 12 }, viewerCloseText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  fullPhoto: { width: '100%', height: '75%' }, viewerDelete: { position: 'absolute', bottom: 42, padding: 14 }, viewerDeleteText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
