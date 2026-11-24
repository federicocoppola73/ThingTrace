import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getContainer, type ContainerDetail } from '@/repositories/containerRepository';
import { initializeDatabase } from '@/database/database';
import { pickAndImportPhotos } from '@/foto/photoPicker';
import { FotoService } from '@/foto/fotoService';
import { getDatabase } from '@/database/database';

export default function ContainerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [container, setContainer] = useState<ContainerDetail | null>(null);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

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
      }
    } catch (error) {
      Alert.alert('Errore', error instanceof Error ? error.message : 'Impossibile caricare il contenitore.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  async function addPhotos() {
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

  if (loading) return <View style={styles.center}><Text style={styles.muted}>Caricamento...</Text></View>;
  if (!container) return <View style={styles.center}><Text>Contenitore non trovato.</Text></View>;

  return (
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
          {photoUris.map((uri, index) => <Image key={uri} source={{ uri }} style={styles.photo} />)}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Non ci sono ancora fotografie associate a questo contenitore.</Text>
        </View>
      )}
      <Pressable style={styles.button} onPress={addPhotos}>
        <Text style={styles.buttonText}>＋  Aggiungi fotografie</Text>
      </Pressable>
      <Text style={styles.footnote}>Le fotografie selezionate vengono copiate nell'archivio privato di ThingTrace. L'originale nella galleria non viene eliminato.</Text>
    </ScrollView>
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
  photo: { width: '31.5%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#E9E8E1' },
  button: { backgroundColor: '#43533C', borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 22 },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  footnote: { color: '#858A80', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 14 }
});