import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { LocationRecord } from '@/repositories/locationRepository';

type Props = {
  locations: LocationRecord[];
  selectedLocationId: string | null;
  onSelect: (id: string | null) => void;
};

function normalize(value: string) {
  return value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const TYPE_LABELS: Record<LocationRecord['type'], string> = {
  AREA: 'Stanza/Zona',
  ROOM: 'Luogo',
  POSITION: 'Posizione',
};

export function LocationPicker({ locations, selectedLocationId, onSelect }: Props) {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<'browse' | 'search'>('browse');
  const [query, setQuery] = useState('');
  const [homeId, setHomeId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);

  const selected = locations.find((item) => item.id === selectedLocationId) ?? null;
  const homes = useMemo(() => {
    const map = new Map<string, string>();
    locations.filter((item) => item.type === 'AREA').forEach((item) => map.set(item.homeId, item.homeName));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'it'));
  }, [locations]);

  const browseItems = useMemo(() => locations
    .filter((item) => item.homeId === homeId && item.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'it')), [locations, homeId, parentId]);

  const searchResults = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return [];
    return locations
      .filter((item) => normalize(item.name).includes(term) || normalize(item.path).includes(term) || normalize(item.homeName).includes(term))
      .sort((a, b) => a.homeName.localeCompare(b.homeName, 'it') || a.path.localeCompare(b.path, 'it'))
;
  }, [locations, query]);

  function openPicker() {
    setMode('browse');
    setQuery('');
    setHomeId(null);
    setParentId(null);
    setVisible(true);
  }

  function choose(id: string | null) {
    onSelect(id);
    setVisible(false);
  }

  const currentHomeName = homes.find(([id]) => id === homeId)?.[1];
  const currentLocation = locations.find((item) => item.id === parentId);
  const currentTitle = currentLocation?.name ?? currentHomeName ?? 'Seleziona una sede';

  return (
    <>
      <Pressable onPress={openPicker} style={styles.selector}>
        <View style={styles.selectorCopy}>
          <Text style={styles.selectorLabel}>{selected ? 'UBICAZIONE SELEZIONATA' : 'NESSUNA UBICAZIONE SELEZIONATA'}</Text>
          <Text style={styles.selectorValue}>{selected ? `${selected.homeName} · ${selected.path}` : 'Scegli un’ubicazione'}</Text>
        </View>
        <Text style={styles.selectorAction}>Cambia</Text>
      </Pressable>

      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setVisible(false)}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.modalTitle}>Scegli ubicazione</Text>
            <Pressable onPress={() => setVisible(false)} hitSlop={12}><Text style={styles.close}>Chiudi</Text></Pressable>
          </View>
          <View style={styles.tabs}>
            <Pressable onPress={() => setMode('browse')} style={[styles.tab, mode === 'browse' && styles.activeTab]}><Text style={[styles.tabText, mode === 'browse' && styles.activeTabText]}>Esplora</Text></Pressable>
            <Pressable onPress={() => setMode('search')} style={[styles.tab, mode === 'search' && styles.activeTab]}><Text style={[styles.tabText, mode === 'search' && styles.activeTabText]}>Cerca</Text></Pressable>
          </View>

          {mode === 'search' ? (
            <>
              <TextInput value={query} onChangeText={setQuery} placeholder="Cerca un'ubicazione, es. Armadio" placeholderTextColor="#858A80" autoFocus style={styles.searchInput} />
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.results}>
                {!query.trim() ? <Text style={styles.empty}>Scrivi il nome o una parte del percorso dell’ubicazione.</Text> : searchResults.length ? searchResults.map((item) => (
                  <View key={item.id} style={styles.resultRow}>
                    <View style={styles.resultCopy}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemPath}>{item.homeName} · {item.path}</Text>
                      <Text style={styles.itemType}>{TYPE_LABELS[item.type]}</Text>
                    </View>
                    <Pressable onPress={() => choose(item.id)} style={styles.chooseButton}><Text style={styles.chooseText}>Scegli</Text></Pressable>
                  </View>
                )) : <Text style={styles.empty}>Nessuna ubicazione trovata.</Text>}
              </ScrollView>
            </>
          ) : (
            <>
              <View style={styles.breadcrumb}>
                {homeId ? <Pressable onPress={() => { setHomeId(null); setParentId(null); }}><Text style={styles.backText}>‹ Sedi</Text></Pressable> : null}
                {parentId ? <Pressable onPress={() => setParentId(locations.find((item) => item.id === parentId)?.parentId ?? null)}><Text style={styles.backText}>‹ Indietro</Text></Pressable> : null}
                <Text style={styles.breadcrumbTitle}>{currentTitle}</Text>
              </View>
              <ScrollView contentContainerStyle={styles.results}>
                {!homeId ? homes.map(([id, name]) => (
                  <Pressable key={id} onPress={() => { setHomeId(id); setParentId(null); }} style={styles.browseRow}>
                    <Text style={styles.itemName}>{name}</Text><Text style={styles.arrow}>›</Text>
                  </Pressable>
                )) : browseItems.map((item) => (
                  <View key={item.id} style={styles.resultRow}>
                    {item.type === 'POSITION' ? (
                      <View style={styles.resultCopy}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemType}>{TYPE_LABELS[item.type]}</Text>
                      </View>
                    ) : (
                      <Pressable onPress={() => setParentId(item.id)} style={styles.resultCopy}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemType}>{TYPE_LABELS[item.type]}</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={() => choose(item.id)} style={styles.chooseButton}><Text style={styles.chooseText}>Scegli</Text></Pressable>
                    {item.type !== 'POSITION' ? <Pressable onPress={() => setParentId(item.id)} style={styles.drillButton}><Text style={styles.arrow}>›</Text></Pressable> : null}
                  </View>
                ))}
                {homeId && browseItems.length === 0 ? <Text style={styles.empty}>Nessuna ubicazione in questo livello.</Text> : null}
              </ScrollView>
            </>
          )}
          <View style={styles.footer}>
            <Pressable onPress={() => choose(null)} style={styles.unassigned}><Text style={styles.unassignedText}>Rimuovi ubicazione / Non assegnata</Text></Pressable>
            <Text style={styles.footerHint}>Puoi selezionare qualsiasi livello da Stanza/Zona in poi. La sede non è assegnabile direttamente.</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: { backgroundColor: '#FFFFFF', borderColor: '#E4E2DA', borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  selectorCopy: { flex: 1, gap: 5 },
  selectorLabel: { color: '#858A80', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  selectorValue: { color: '#35472F', fontSize: 14, fontWeight: '700' },
  selectorAction: { color: '#526447', fontWeight: '800' },
  modal: { flex: 1, backgroundColor: '#FAFAF7', paddingTop: 20 },
  header: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: '#252923', fontSize: 21, fontWeight: '800' },
  close: { color: '#526447', fontWeight: '700' },
  tabs: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#EDEEE8', borderRadius: 11, padding: 3 },
  tab: { flex: 1, padding: 11, alignItems: 'center', borderRadius: 9 },
  activeTab: { backgroundColor: '#FFFFFF' },
  tabText: { color: '#68715E', fontWeight: '700' },
  activeTabText: { color: '#35472F' },
  searchInput: { margin: 20, marginBottom: 8, backgroundColor: '#FFFFFF', borderColor: '#E4E2DA', borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, color: '#252923' },
  breadcrumb: { minHeight: 58, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  backText: { color: '#526447', fontWeight: '800' },
  breadcrumbTitle: { color: '#252923', fontSize: 16, fontWeight: '800', flex: 1 },
  results: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  resultRow: { backgroundColor: '#FFFFFF', borderColor: '#E4E2DA', borderWidth: 1, borderRadius: 11, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultCopy: { flex: 1, gap: 3 },
  itemName: { color: '#252923', fontSize: 15, fontWeight: '700' },
  itemPath: { color: '#68715E', fontSize: 12 },
  itemType: { color: '#858A80', fontSize: 11 },
  chooseButton: { backgroundColor: '#E8EDE3', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  chooseText: { color: '#35472F', fontWeight: '800', fontSize: 12 },
  drillButton: { paddingHorizontal: 4, paddingVertical: 6 },
  browseRow: { backgroundColor: '#FFFFFF', borderColor: '#E4E2DA', borderWidth: 1, borderRadius: 11, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { color: '#526447', fontSize: 24, fontWeight: '500' },
  empty: { color: '#858A80', padding: 14, lineHeight: 20 },
  footer: { borderTopWidth: 1, borderTopColor: '#E4E2DA', padding: 16, gap: 8 },
  unassigned: { padding: 12, alignItems: 'center' },
  unassignedText: { color: '#9A5147', fontWeight: '800' },
  footerHint: { color: '#858A80', fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
