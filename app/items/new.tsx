import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { createItem } from '@/repositories/itemRepository';
import { listContainers, type ContainerSummary } from '@/repositories/containerRepository';
import { listLocations, type LocationRecord } from '@/repositories/locationRepository';
import { ContainerPicker } from '@/components/ContainerPicker';

export default function NewItemScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [containerId, setContainerId] = useState<string | null>(null);
  const [containers, setContainers] = useState<ContainerSummary[]>([]);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [saving, setSaving] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([listContainers(), listLocations()]).then(([rows, places]) => {
      if (active) { setContainers(rows); setLocations(places); }
    }).catch((error) => Alert.alert('Errore', error instanceof Error ? error.message : 'Impossibile caricare le ubicazioni.'));
    return () => { active = false; };
  }, []));
  async function save() {
    const parsedQuantity = Number(quantity);
    if (!name.trim()) { Alert.alert('Nome necessario', 'Inserisci un nome per l’oggetto.'); return; }
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) { Alert.alert('Quantità non valida', 'Inserisci un numero intero maggiore di zero.'); return; }
    setSaving(true);
    try {
      const id = await createItem({ name, description: description || null, quantity: parsedQuantity, notes: notes || null, containerId });
      router.replace({ pathname: '/items/[id]', params: { id } });
    } catch (error) { Alert.alert('Salvataggio non riuscito', error instanceof Error ? error.message : 'Errore imprevisto.'); }
    finally { setSaving(false); }
  }
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text style={styles.label}>NOME OGGETTO</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Es. Macchina fotografica" style={styles.input} returnKeyType="next" />
        <Text style={styles.label}>DESCRIZIONE (FACOLTATIVA)</Text>
        <TextInput value={description} onChangeText={setDescription} placeholder="Marca, modello, caratteristiche..." style={[styles.input, styles.multiline]} multiline />
        <Text style={styles.label}>QUANTITÀ</Text>
        <TextInput value={quantity} onChangeText={setQuantity} keyboardType="number-pad" style={styles.input} />
        <Text style={styles.label}>CONTENITORE (FACOLTATIVO)</Text>
        <ContainerPicker containers={containers} locations={locations} selectedContainerId={containerId} onSelect={setContainerId} />
        <Text style={styles.label}>NOTE (FACOLTATIVE)</Text>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Aggiungi dettagli utili..." style={[styles.input, styles.multiline]} multiline />
        <Pressable disabled={saving} onPress={save} style={[styles.button, saving && { opacity: 0.6 }]}><Text style={styles.buttonText}>{saving ? 'Salvataggio...' : 'Crea oggetto'}</Text></Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { padding: 22, paddingTop: 25, paddingBottom: 56, flexGrow: 1 },
  label: { fontSize: 11, letterSpacing: 1.1, fontWeight: '800', color: '#747A6E', marginBottom: 9, marginTop: 18 },
  input: { backgroundColor: '#FFFFFF', borderColor: '#E4E2DA', borderWidth: 1, borderRadius: 12, padding: 15, fontSize: 16, color: '#252923' },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  button: { marginTop: 28, backgroundColor: '#43533C', borderRadius: 14, padding: 17, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 }
});