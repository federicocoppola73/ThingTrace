import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { createContainer } from '@/repositories/containerRepository';
import { listLocations, type LocationRecord } from '@/repositories/locationRepository';

const TYPES = [
  { value: 'BOX', label: 'Scatola' },
  { value: 'BINDER', label: 'Raccoglitore' },
  { value: 'FOLDER', label: 'Cartellina' },
  { value: 'DRAWER', label: 'Cassetto' },
  { value: 'CABINET', label: 'Armadio' },
  { value: 'SHELF', label: 'Scaffale' },
  { value: 'OTHER', label: 'Altro' }
] as const;

export default function NewContainerScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof TYPES)[number]['value']>('BOX');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { let active = true; listLocations().then((items) => { if (active) setLocations(items); }).catch((error) => Alert.alert('Errore ubicazioni', error instanceof Error ? error.message : 'Impossibile caricare le ubicazioni.')); return () => { active = false; }; }, []));

  async function save() {
    if (!name.trim()) {
      Alert.alert('Nome necessario', 'Inserisci un nome per il contenitore.');
      return;
    }
    setSaving(true);
    try {
      const id = await createContainer({ name: name.trim(), type, notes: notes.trim() || null, locationId });
      router.replace({ pathname: '/containers/[id]', params: { id } });
    } catch (error) {
      Alert.alert('Salvataggio non riuscito', error instanceof Error ? error.message : 'Errore imprevisto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.label}>NOME</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Es. Scatola decorazioni Natale" style={styles.input} autoFocus />
      <Text style={styles.label}>TIPO DI CONTENITORE</Text>
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
      ) : <Text style={styles.locationHint}>Non hai ancora creato ubicazioni. Puoi configurarle dalla schermata principale.</Text>}
      <Pressable onPress={() => router.push('/locations')} style={styles.manageLocations}><Text style={styles.manageLocationsText}>Gestisci ubicazioni</Text></Pressable>
      <Text style={styles.label}>NOTE (FACOLTATIVE)</Text>
      <TextInput value={notes} onChangeText={setNotes} placeholder="Aggiungi dettagli utili..." style={[styles.input, styles.notes]} multiline />
      <Pressable disabled={saving} onPress={save} style={[styles.button, saving && { opacity: 0.6 }]}>
        <Text style={styles.buttonText}>{saving ? 'Salvataggio...' : 'Crea contenitore'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 22, paddingTop: 28 },
  label: { fontSize: 11, letterSpacing: 1.1, fontWeight: '800', color: '#747A6E', marginBottom: 9, marginTop: 19 },
  input: { backgroundColor: '#FFFFFF', borderColor: '#E4E2DA', borderWidth: 1, borderRadius: 12, padding: 15, fontSize: 16, color: '#252923' },
  notes: { minHeight: 100, textAlignVertical: 'top' },
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
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 }
});