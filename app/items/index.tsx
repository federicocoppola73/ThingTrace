import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { listItems, type ItemSummary } from '@/repositories/itemRepository';

export default function ItemsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => {
    listItems().then(setItems).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Errore caricamento oggetti.'));
  }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
  const filtered = useMemo(() => {
    const query = normalize(search);
    return items.filter((item) => !query || [item.name, item.description ?? '', item.notes ?? '', item.currentContainerName ?? ''].some((value) => normalize(value).includes(query)));
  }, [items, search]);
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}><Text style={styles.title}>I tuoi oggetti</Text><Text style={styles.count}>{search.trim() ? filtered.length + ' / ' + items.length : items.length}</Text></View>
      <TextInput value={search} onChangeText={setSearch} placeholder="Cerca per nome, descrizione, note o contenitore..." placeholderTextColor="#92968E" style={styles.search} clearButtonMode="while-editing" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {filtered.length ? filtered.map((item) => (
        <Pressable key={item.id} style={styles.card} onPress={() => router.push({ pathname: '/items/[id]', params: { id: item.id } })}>
          <View style={styles.icon}><Text style={styles.iconText}>◇</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.name}>{item.name}</Text><Text style={styles.meta}>Quantità: {item.quantity}{item.currentContainerName ? ' · ' + item.currentContainerName : ' · Non assegnato'}</Text></View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      )) : <View style={styles.empty}><Text style={styles.emptyTitle}>{items.length ? 'Nessun oggetto trovato' : 'Nessun oggetto ancora'}</Text><Text style={styles.emptyText}>{items.length ? 'Prova con un’altra parola.' : 'Aggiungi il primo oggetto al tuo inventario.'}</Text></View>}
      <Pressable style={styles.button} onPress={() => router.push('/items/new')}><Text style={styles.buttonText}>＋  Aggiungi oggetto</Text></Pressable>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  page: { padding: 22, paddingTop: 28, paddingBottom: 42 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  title: { flex: 1, fontSize: 25, fontWeight: '800', color: '#252923' },
  count: { color: '#74796F', fontWeight: '700' },
  search: { backgroundColor: '#FFFFFF', borderColor: '#E4E2DA', borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14, color: '#252923', marginBottom: 16 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#ECEAE3' },
  icon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#EEF0E8', alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  iconText: { fontSize: 24, color: '#5D6B50' }, name: { fontSize: 16, fontWeight: '700', color: '#2A2F28' },
  meta: { fontSize: 12, color: '#81867C', marginTop: 5 }, chevron: { fontSize: 26, color: '#9A9E95', marginLeft: 8 },
  empty: { borderWidth: 1, borderColor: '#E3E1D9', borderStyle: 'dashed', borderRadius: 18, padding: 25, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#30352D' }, emptyText: { textAlign: 'center', color: '#777C72', lineHeight: 21, marginTop: 7 },
  button: { marginTop: 22, backgroundColor: '#43533C', borderRadius: 14, padding: 17, alignItems: 'center' }, buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  error: { color: '#A33D32', marginBottom: 12 }
});