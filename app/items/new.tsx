import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { createItem } from '@/repositories/itemRepository';
import { listContainers, type ContainerSummary } from '@/repositories/containerRepository';

export default function NewItemScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [containerId, setContainerId] = useState<string | null>(null);
  const [containers, setContainers] = useState<ContainerSummary[]>([]);
  const [saving, setSaving] = useState(false);
  useFocusEffect(useCallback(() => { let active = true; listContainers().then((rows) => { if (active) setContainers(rows); }).catch((error) => Alert.alert('Errore', error instanceof Error ? error.message : 'Impossibile caricare i contenitori.')); return () => { active = false; }; }, []));
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
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.label}>NOME OGGETTO</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Es. Macchina fotografica" style={styles.input} autoFocus />
      <Text style={styles.label}>DESCRIZIONE (FACOLTATIVA)</Text>
      <TextInput value={description} onChangeText={setDescription} placeholder="Marca, modello, caratteristiche..." style={[styles.input, styles.multiline]} multiline />
      <Text style={styles.label}>QUANTITÀ</Text>
      <TextInput value={quantity} onChangeText={setQuantity} keyboardType="number-pad" style={styles.input} />
      <Text style={styles.label}>CONTENITORE (FACOLTATIVO)</Text>
      <View style={styles.options}>
        <Pressable onPress={() => setContainerId(null)} style={[styles.option, containerId === null && styles.selected]}><Text style={[styles.optionText, containerId === null && styles.selectedText]}>Non assegnato</Text></Pressable>
        {containers.map((container) => <Pressable key={container.id} onPress={() => setContainerId(container.id)} style={[styles.option, containerId === container.id && styles.selected]}><Text style={[styles.optionText, containerId === container.id && styles.selectedText]}>{container.name}{container.locationName ? ' · ' + container.locationName : ''}</Text></Pressable>)}
      </View>
      <Text style={styles.label}>NOTE (FACOLTATIVE)</Text>
      <TextInput value={notes} onChangeText={setNotes} placeholder="Aggiungi dettagli utili..." style={[styles.input, styles.multiline]} multiline />
      <Pressable disabled={saving} onPress={save} style={[styles.button, saving && { opacity: 0.6 }]}><Text style={styles.buttonText}>{saving ? 'Salvataggio...' : 'Crea oggetto'}</Text></Pressable>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  page: { padding: 22, paddingTop: 25, paddingBottom: 42 },
  label: { fontSize: 11, letterSpacing: 1.1, fontWeight: '800', color: '#747A6E', marginBottom: 9, marginTop: 18 },
  input: { backgroundColor: '#FFFFFF', borderColor: '#E4E2DA', borderWidth: 1, borderRadius: 12, padding: 15, fontSize: 16, color: '#252923' },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  options: { gap: 8 },
  option: { backgroundColor: '#FFFFFF', borderColor: '#E2E2DA', borderWidth: 1, borderRadius: 11, padding: 12 },
  selected: { backgroundColor: '#E8EDE3', borderColor: '#64765A' },
  optionText: { color: '#545B4E', fontSize: 13 }, selectedText: { color: '#35472F', fontWeight: '800' },
  button: { marginTop: 28, backgroundColor: '#43533C', borderRadius: 14, padding: 17, alignItems: 'center' }, buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 }
});