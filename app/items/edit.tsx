import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { getItem, updateItem } from '@/repositories/itemRepository';

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (id) getItem(id).then((item) => { if (active && item) { setName(item.name); setDescription(item.description ?? ''); setQuantity(String(item.quantity)); setNotes(item.notes ?? ''); } }).catch((error) => Alert.alert('Errore', error instanceof Error ? error.message : 'Impossibile caricare l’oggetto.'));
    return () => { active = false; };
  }, [id]));
  async function save() {
    const parsed = Number(quantity);
    if (!Number.isInteger(parsed) || parsed < 1) { Alert.alert('Quantità non valida', 'Inserisci un numero intero maggiore di zero.'); return; }
    if (!id) return;
    setSaving(true);
    try { await updateItem(id, { name, description: description || null, quantity: parsed, notes: notes || null }); router.back(); }
    catch (error) { Alert.alert('Salvataggio non riuscito', error instanceof Error ? error.message : 'Errore imprevisto.'); }
    finally { setSaving(false); }
  }
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text style={styles.label}>NOME OGGETTO</Text><TextInput value={name} onChangeText={setName} style={styles.input} returnKeyType="next" />
        <Text style={styles.label}>DESCRIZIONE</Text><TextInput value={description} onChangeText={setDescription} style={[styles.input, styles.multiline]} multiline />
        <Text style={styles.label}>QUANTITÀ</Text><TextInput value={quantity} onChangeText={setQuantity} keyboardType="number-pad" style={styles.input} />
        <Text style={styles.label}>NOTE</Text><TextInput value={notes} onChangeText={setNotes} style={[styles.input, styles.multiline]} multiline />
        <Pressable disabled={saving} onPress={save} style={styles.button}><Text style={styles.buttonText}>{saving ? 'Salvataggio...' : 'Salva modifiche'}</Text></Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { padding: 22, paddingTop: 25, paddingBottom: 56, flexGrow: 1 },
  label: { fontSize: 11, letterSpacing: 1.1, fontWeight: '800', color: '#747A6E', marginBottom: 9, marginTop: 18 },
  input: { backgroundColor: '#FFFFFF', borderColor: '#E4E2DA', borderWidth: 1, borderRadius: 12, padding: 15, fontSize: 16, color: '#252923' },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  button: { marginTop: 28, backgroundColor: '#43533C', borderRadius: 14, padding: 17, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 }
});