import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getDatabase } from '@/database/database';
import { FotoService } from '@/foto/fotoService';
import { PhotoStorage } from '@/foto/photoStorage';
import type { PhotoRecord } from '@/foto/types';

export default function TrashScreen() {
  const [photos, setPhotos] = useState<Array<{ photo: PhotoRecord; uri: string }>>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const service = new FotoService(await getDatabase());
      const storage = new PhotoStorage();
      const records = await service.getTrash();
      const entries = await Promise.all(records.map(async photo => {
        try { return { photo, uri: await storage.getUri(photo.filePath) }; }
        catch { return { photo, uri: '' }; }
      }));
      setPhotos(entries);
    } catch (error) {
      Alert.alert('Errore cestino', error instanceof Error ? error.message : 'Impossibile caricare il cestino.');
    } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  function restore(photo: PhotoRecord) {
    Alert.alert('Ripristinare la fotografia?', 'La foto tornerà disponibile nelle associazioni originali.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Ripristina', onPress: async () => {
        try { await new FotoService(await getDatabase()).restorePhoto(photo.id); await refresh(); }
        catch (error) { Alert.alert('Ripristino non riuscito', error instanceof Error ? error.message : 'Impossibile ripristinare la foto.'); }
      }},
    ]);
  }
  function erase(photo: PhotoRecord) {
    Alert.alert('Eliminare definitivamente?', 'Il file fotografico e i relativi dati saranno eliminati dal dispositivo. Operazione irreversibile.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina definitivamente', style: 'destructive', onPress: async () => {
        try { await new FotoService(await getDatabase()).permanentlyDelete(photo.id); await refresh(); }
        catch (error) { Alert.alert('Eliminazione non riuscita', error instanceof Error ? error.message : 'Impossibile eliminare la foto.'); }
      }},
    ]);
  }

  return <ScrollView contentContainerStyle={s.page}>
    <Text style={s.intro}>Le foto nel cestino non compaiono più nei contenitori. Puoi ripristinarle o eliminarle definitivamente.</Text>
    {loading ? <Text>Caricamento...</Text> : photos.length === 0 ? <View style={s.empty}><Text style={s.title}>Il cestino è vuoto</Text></View> :
      photos.map(({ photo, uri }) => <View key={photo.id} style={s.card}>
        {uri ? <Image source={{ uri }} style={s.image} /> : <View style={s.image}><Text>File non disponibile</Text></View>}
        <View style={s.info}>
          <Text style={s.name}>{photo.originalName || photo.fileName}</Text>
          <Text style={s.date}>Nel cestino dal {new Date(photo.deletedAt || photo.updatedAt).toLocaleDateString()}</Text>
          <Pressable onPress={() => restore(photo)}><Text style={s.restore}>Ripristina</Text></Pressable>
          <Pressable onPress={() => erase(photo)}><Text style={s.erase}>Elimina definitivamente</Text></Pressable>
        </View>
      </View>)}
  </ScrollView>;
}
const s = StyleSheet.create({
  page: { padding: 20, paddingBottom: 40 }, intro: { color: '#62685E', lineHeight: 21, marginBottom: 18 },
  empty: { padding: 25, borderWidth: 1, borderStyle: 'dashed', borderColor: '#DDDCD4', borderRadius: 16, alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: '#30352D' }, card: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 15, backgroundColor: '#FFFFFF', marginBottom: 10 },
  image: { width: 88, height: 88, borderRadius: 10, backgroundColor: '#E9E8E1', alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, justifyContent: 'center', gap: 7 }, name: { fontWeight: '700', color: '#30352D' }, date: { fontSize: 11, color: '#858A80' },
  restore: { color: '#43533C', fontWeight: '800', fontSize: 13 }, erase: { color: '#A33D32', fontWeight: '700', fontSize: 12 }
});