import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getContainer } from '@/repositories/containerRepository';
import { listItems, moveItem, type ItemSummary } from '@/repositories/itemRepository';

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').trim();
}

export default function AddItemsToContainerScreen() {
  const { containerId } = useLocalSearchParams<{ containerId: string }>();
  const router = useRouter();
  const [containerName, setContainerName] = useState('');
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!containerId) return;
    setLoading(true);
    try {
      const [container, rows] = await Promise.all([getContainer(containerId), listItems()]);
      setContainerName(container?.name ?? 'Contenitore');
      setItems(rows);
    } catch (error) {
      Alert.alert('Errore', error instanceof Error ? error.message : 'Impossibile caricare gli oggetti.');
    } finally {
      setLoading(false);
    }
  }, [containerId]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const filteredItems = useMemo(() => {
    const term = normalize(query);
    if (!term) return items;
    return items.filter((item) => normalize([
      item.name,
      item.description ?? '',
      item.notes ?? '',
      item.currentContainerName ?? '',
      item.currentLocationName ?? '',
    ].join(' ')).includes(term));
  }, [items, query]);

  function placementLabel(item: ItemSummary) {
    if (item.currentContainerId === containerId) return 'Già in questo contenitore';
    if (item.currentContainerName) return 'Contenitore: ' + item.currentContainerName;
    if (item.currentLocationName) return 'Ubicazione: ' + item.currentLocationName;
    return 'Non assegnato';
  }

  function confirmAdd(item: ItemSummary) {
    if (!containerId || item.currentContainerId === containerId || busyId) return;
    const from = item.currentContainerName ?? item.currentLocationName ?? 'Non assegnato';
    Alert.alert(
      'Aggiungere al contenitore?',
      '“' + item.name + '” verrà spostato da ' + from + ' a ' + containerName + '. L’operazione sarà registrata nello storico.',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Aggiungi', onPress: () => { void addItem(item); } },
      ]
    );
  }

  async function addItem(item: ItemSummary) {
    if (!containerId) return;
    setBusyId(item.id);
    try {
      await moveItem(item.id, { kind: 'container', id: containerId }, 'Aggiunto al contenitore');
      await refresh();
      Alert.alert('Oggetto aggiunto', '“' + item.name + '” è ora associato a ' + containerName + '.');
    } catch (error) {
      Alert.alert('Operazione non riuscita', error instanceof Error ? error.message : 'Impossibile associare l’oggetto.');
    } finally {
      setBusyId(null);
    }
  }

  function createNewItem() {
    router.push({ pathname: '/items/new', params: { containerId } });
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Aggiungi oggetti</Text>
      <Text style={styles.subtitle}>Cerca nell’inventario e seleziona un oggetto da associare a {containerName || 'questo contenitore'}.</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Cerca per nome, descrizione o collocazione..."
        placeholderTextColor="#858A80"
        style={styles.search}
        autoCapitalize="none"
        returnKeyType="search"
      />
      <Pressable style={styles.createButton} onPress={createNewItem}>
        <Text style={styles.createButtonText}>＋ Crea nuovo oggetto</Text>
      </Pressable>

      {loading ? (
        <Text style={styles.emptyText}>Caricamento inventario...</Text>
      ) : filteredItems.length ? (
        <View style={styles.list}>
          {filteredItems.map((item) => {
            const alreadyHere = item.currentContainerId === containerId;
            return (
              <Pressable
                key={item.id}
                style={[styles.itemCard, alreadyHere && styles.itemCardDisabled]}
                onPress={() => confirmAdd(item)}
                disabled={alreadyHere || busyId !== null}
                accessibilityRole="button"
                accessibilityLabel={alreadyHere ? item.name + ', già nel contenitore' : 'Aggiungi ' + item.name}
              >
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.description ? <Text style={styles.description} numberOfLines={2}>{item.description}</Text> : null}
                  <Text style={styles.placement}>{placementLabel(item)}</Text>
                </View>
                <Text style={alreadyHere ? styles.already : styles.action}>{alreadyHere ? '✓' : busyId === item.id ? '…' : '＋'}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.noResults}>
          <Text style={styles.emptyTitle}>{query.trim() ? 'Nessun oggetto trovato' : 'Inventario vuoto'}</Text>
          <Text style={styles.emptyText}>{query.trim() ? 'Non ci sono oggetti che corrispondono alla ricerca.' : 'Non hai ancora creato oggetti nell’inventario.'}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 22, paddingBottom: 48, flexGrow: 1 },
  heading: { color: '#252923', fontSize: 25, fontWeight: '800' },
  subtitle: { color: '#687064', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 20 },
  search: { backgroundColor: '#FFFFFF', borderColor: '#E4E2DA', borderWidth: 1, borderRadius: 13, padding: 15, color: '#252923', fontSize: 15, marginBottom: 18 },
  list: { gap: 9 },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#ECEAE3', borderWidth: 1, borderRadius: 13, padding: 15, gap: 12 },
  itemCardDisabled: { opacity: 0.58 },
  itemInfo: { flex: 1 },
  itemName: { color: '#252923', fontSize: 15, fontWeight: '800' },
  description: { color: '#777D72', fontSize: 12, lineHeight: 17, marginTop: 4 },
  placement: { color: '#7D8377', fontSize: 11, marginTop: 6 },
  action: { color: '#43533C', fontSize: 23, fontWeight: '700' },
  already: { color: '#68715E', fontSize: 20, fontWeight: '800' },
  noResults: { alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#E1DFD7', borderRadius: 16, padding: 24, marginTop: 4 },
  emptyTitle: { color: '#252923', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#777D72', textAlign: 'center', lineHeight: 21, marginTop: 7 },
  createButton: { backgroundColor: '#43533C', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center', marginBottom: 18 },
  createButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
