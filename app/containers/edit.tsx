import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getContainer, updateContainer, type ContainerType } from '@/repositories/containerRepository';
import { listLocations, type LocationRecord } from '@/repositories/locationRepository';

const TYPES: { value: ContainerType; label: string }[] = [
  { value: 'BOX', label: 'Scatola' },
  { value: 'BINDER', label: 'Raccoglitore' },
  { value: 'FOLDER', label: 'Cartellina' },
  { value: 'DRAWER', label: 'Cassetto' },
  { value: 'CABINET', label: 'Armadio' },
  { value: 'SHELF', label: 'Scaffale' },
  { value: 'OTHER', label: 'Altro' },
];

export default function EditContainerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState<ContainerType>('BOX');
  const [notes, setNotes] = useState('');
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!id) return;
    getContainer(id).then((container) => {
      if (!active) return;
      if (!container) {
        Alert.alert('Contenitore non trovato', 'Impossibile modificare questo contenitore.');
        router.back();
        return;
      }
      setName(container.name);
      setType(container.type);
      setNotes(container.notes ?? '');
      setLocationId(container.locationId);
    }).catch((error) => {
      Alert.alert('Errore', error instanceof Error ? error.message : 'Impossibile caricare il contenitore.');
      router.back();
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, router]);

  useFocusEffect(useCallback(() => { let active = true; listLocations().then((items) => { if (active) setLocations(items); }).catch((error) => Alert.alert('Errore ubicazioni', error instanceof Error ? error.message : 'Impossibile caricare le ubicazioni.')); return () => { active = false; }; }, []));

  async function save() {
    if (!name.trim()) {
      Alert.alert('Nome necessario', 'Inserisci un nome per il contenitore.');
      return;
    }
    if (!id) return;
    setSaving(true);
    try {
      await updateContainer(id, { name: name.trim(), type, notes: notes.trim() || null, locationId });
      router.replace({ pathname: '/containers/[id]', params: { id } });
    } catch (error) {
      Alert.alert('Modifica non riuscita', error instanceof Error ? error.message : 'Errore imprevisto.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={styles.center}><Text>Caricamento...</Text></View>;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.intro}>Aggiorna le informazioni principali del contenitore. Le fotografie e le associazioni resteranno invariate.</Text>
      <Text style={styles.label}>NOME</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Nome del contenitore" style={styles.input} autoFocus />
      <Text style={styles.label}>TIPOLOGIA</Text>
      <View style={styles.typeGrid}>
        {TYPES.map((item) => (
          <Pressable key={item.value} onPress={() => setType(item.value)} style={[styles.typeOption, type === item.value && styles.typeSelected]}>
            <Text style={[styles.typeText, type === item.value && styles.typeTextSelected]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>UBICAZIONE (FACOLTATIVA)</Text>
      {locations.length ? (
        <View style={styles.locationList}>
          <Pressable onPress={() => setLocationId(null)} style={[styles.locationOption, !locationId && styles.locationSelected]}><Text style={[styles.locationText, !locationId && styles.locationTextSelected]}>Non assegnata</Text></Pressable>
          {locations.map((location) => {
            const selected = locationId === location.id;
            return <Pressable key={location.id} onPress={() => setLocationId(location.id)} style={[styles.locationOption, selected && styles.locationSelected]}><Text style={[styles.locationText, selected && styles.locationTextSelected]}>{location.homeName} · {location.path}</Text></Pressable>;
          })}
        </View>
      ) : <Text style={styles.locationHint}>Nessuna ubicazione configurata.</Text>}
      <Pressable onPress={() => router.push('/locations')} style={styles.manageLocations}><Text style={styles.manageLocationsText}>Gestisci ubicazioni</Text></Pressable>
      <Text style={styles.label}>NOTE (FACOLTATIVE)</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Aggiungi dettagli utili..."
        placeholderTextColor="#92968E"
        style={[styles.input, styles.notes]}
        multiline
        textAlignVertical="top"
      />
      <Pressable disabled={saving} onPress={save} style={[styles.button, saving && { opacity: 0.6 }]}>
        <Text style={styles.buttonText}>{saving ? 'Salvataggio...' : 'Salva modifiche'}</Text>
      </Pressable>
      <Pressable disabled={saving} onPress={() => router.back()} style={styles.cancel}>
        <Text style={styles.cancelText}>Annulla</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 22, paddingTop: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  intro: { color: '#68715E', lineHeight: 21 },
  label: { fontSize: 11, letterSpacing: 1.1, fontWeight: '800', color: '#747A6E', marginBottom: 9, marginTop: 22 },
  input: { backgroundColor: '#FFFFFF', borderColor: '#E4E2DA', borderWidth: 1, borderRadius: 12, padding: 15, fontSize: 16, color: '#252923' },
  notes: { minHeight: 110, textAlignVertical: 'top' },
  locationList: { gap: 8 },
  locationOption: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E2DA', borderRadius: 10, padding: 12 },
  locationSelected: { backgroundColor: '#E8EDE3', borderColor: '#64765A' },
  locationText: { color: '#545B4E', fontSize: 13 },
  locationTextSelected: { color: '#35472F', fontWeight: '800' },
  locationHint: { color: '#858A80', fontSize: 13 },
  manageLocations: { alignSelf: 'flex-start', paddingVertical: 10 },
  manageLocationsText: { color: '#526447', fontWeight: '800', fontSize: 13 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  typeOption: { borderRadius: 12, borderWidth: 1, borderColor: '#E2E2DA', paddingHorizontal: 15, paddingVertical: 12, backgroundColor: '#FFFFFF' },
  typeSelected: { backgroundColor: '#E8EDE3', borderColor: '#64765A' },
  typeText: { color: '#545B4E', fontWeight: '600' },
  typeTextSelected: { color: '#35472F', fontWeight: '800' },
  button: { marginTop: 30, backgroundColor: '#43533C', borderRadius: 14, padding: 17, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  cancel: { padding: 15, alignItems: 'center', marginTop: 8 },
  cancelText: { color: '#68715E', fontWeight: '700' },
});
