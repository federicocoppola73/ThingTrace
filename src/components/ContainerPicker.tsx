import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ContainerSummary } from '@/repositories/containerRepository';
import type { LocationRecord } from '@/repositories/locationRepository';

type Props = {
  containers: ContainerSummary[];
  locations: LocationRecord[];
  selectedContainerId: string | null;
  onSelect: (id: string | null) => void;
};

function normalize(value: string) {
  return value.toLocaleLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
}

export function ContainerPicker({ containers, locations, selectedContainerId, onSelect }: Props) {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<'browse' | 'search'>('browse');
  const [query, setQuery] = useState('');
  const [homeId, setHomeId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);

  const selected = containers.find((item) => item.id === selectedContainerId) ?? null;
  const homes = useMemo(() => {
    const map = new Map<string, string>();
    locations.filter((item) => item.type === 'AREA').forEach((item) => map.set(item.homeId, item.homeName));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'it'));
  }, [locations]);
  const browseLocations = useMemo(() => locations
    .filter((item) => item.homeId === homeId && item.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'it')), [locations, homeId, parentId]);
  const browseContainers = useMemo(() => containers
    .filter((item) => item.locationId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'it')), [containers, parentId]);
  const searchResults = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return [];
    return containers.filter((item) =>
      normalize(item.name).includes(term) || normalize(item.locationName ?? '').includes(term)
    ).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  }, [containers, query]);

  function openPicker() {
    setMode('browse'); setQuery(''); setHomeId(null); setParentId(null); setVisible(true);
  }
  function choose(id: string | null) {
    onSelect(id); setVisible(false);
  }
  const currentLocation = locations.find((item) => item.id === parentId);
  const currentHome = homes.find(([id]) => id === homeId)?.[1];

  return (
    <>
      <Pressable onPress={openPicker} style={styles.selector}>
        <View style={styles.selectorCopy}>
          <Text style={styles.selectorLabel}>{selected ? 'CONTENITORE SELEZIONATO' : 'NESSUN CONTENITORE SELEZIONATO'}</Text>
          <Text style={styles.selectorValue}>{selected ? selected.name + (selected.locationName ? ' · ' + selected.locationName : '') : 'Scegli un contenitore'}</Text>
        </View>
        <Text style={styles.selectorAction}>Cambia</Text>
      </Pressable>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setVisible(false)}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.modalTitle}>Scegli contenitore</Text>
            <Pressable onPress={() => setVisible(false)} hitSlop={12}><Text style={styles.close}>Chiudi</Text></Pressable>
          </View>
          <View style={styles.tabs}>
            <Pressable onPress={() => setMode('browse')} style={[styles.tab, mode === 'browse' && styles.activeTab]}><Text style={[styles.tabText, mode === 'browse' && styles.activeTabText]}>Esplora</Text></Pressable>
            <Pressable onPress={() => setMode('search')} style={[styles.tab, mode === 'search' && styles.activeTab]}><Text style={[styles.tabText, mode === 'search' && styles.activeTabText]}>Cerca</Text></Pressable>
          </View>
          {mode === 'search' ? (
            <>
              <TextInput value={query} onChangeText={setQuery} placeholder="Cerca per nome o ubicazione..." placeholderTextColor="#858A80" style={styles.searchInput} />
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.results}>
                {!query.trim() ? <Text style={styles.empty}>Scrivi il nome del contenitore o una parte della sua ubicazione.</Text> : searchResults.length ? searchResults.map((item) => (
                  <Pressable key={item.id} onPress={() => choose(item.id)} style={styles.resultRow}>
                    <View style={styles.resultCopy}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.itemPath}>{item.locationName ?? 'Senza ubicazione'} · {item.typeLabel}</Text></View>
                    <Text style={styles.chooseText}>Scegli</Text>
                  </Pressable>
                )) : <Text style={styles.empty}>Nessun contenitore trovato.</Text>}
              </ScrollView>
            </>
          ) : (
            <>
              <View style={styles.breadcrumb}>
                {homeId ? <Pressable onPress={() => { setHomeId(null); setParentId(null); }}><Text style={styles.backText}>‹ Sedi</Text></Pressable> : null}
                {parentId ? <Pressable onPress={() => setParentId(locations.find((item) => item.id === parentId)?.parentId ?? null)}><Text style={styles.backText}>‹ Indietro</Text></Pressable> : null}
                <Text style={styles.breadcrumbTitle}>{currentLocation?.name ?? currentHome ?? 'Seleziona una sede'}</Text>
              </View>
              <ScrollView contentContainerStyle={styles.results}>
                {!homeId ? homes.map(([id, name]) => (
                  <Pressable key={id} onPress={() => { setHomeId(id); setParentId(null); }} style={styles.browseRow}><Text style={styles.itemName}>{name}</Text><Text style={styles.arrow}>›</Text></Pressable>
                )) : null}
                {browseLocations.map((location) => (
                  <Pressable key={location.id} onPress={() => setParentId(location.id)} style={styles.browseRow}><View style={styles.resultCopy}><Text style={styles.itemName}>{location.name}</Text><Text style={styles.itemPath}>{location.type === 'AREA' ? 'Stanza/Zona' : location.type === 'ROOM' ? 'Luogo' : 'Posizione'}</Text></View><Text style={styles.arrow}>›</Text></Pressable>
                ))}
                {browseContainers.map((item) => (
                  <Pressable key={item.id} onPress={() => choose(item.id)} style={styles.resultRow}><View style={styles.resultCopy}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.itemPath}>{item.typeLabel}</Text></View><Text style={styles.chooseText}>Scegli</Text></Pressable>
                ))}
                {homeId && browseLocations.length === 0 && browseContainers.length === 0 ? <Text style={styles.empty}>Nessun contenitore o livello successivo in questa ubicazione.</Text> : null}
              </ScrollView>
            </>
          )}
          <View style={styles.footer}>
            <Pressable onPress={() => choose(null)} style={styles.unassigned}><Text style={styles.unassignedText}>Non assegnato</Text></Pressable>
            <Text style={styles.footerHint}>Esplora le sedi e le ubicazioni oppure cerca direttamente un contenitore.</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: { backgroundColor: '#FFFFFF', borderColor: '#E4E2DA', borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  selectorCopy: { flex: 1, gap: 5 }, selectorLabel: { color: '#858A80', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  selectorValue: { color: '#35472F', fontSize: 14, fontWeight: '700' }, selectorAction: { color: '#526447', fontWeight: '800' },
  modal: { flex: 1, backgroundColor: '#FAFAF7', paddingTop: 20 }, header: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: '#252923', fontSize: 21, fontWeight: '800' }, close: { color: '#526447', fontWeight: '700' },
  tabs: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#EDEEE8', borderRadius: 11, padding: 3 },
  tab: { flex: 1, padding: 11, alignItems: 'center', borderRadius: 9 }, activeTab: { backgroundColor: '#FFFFFF' },
  tabText: { color: '#68715E', fontWeight: '700' }, activeTabText: { color: '#35472F' },
  searchInput: { margin: 20, marginBottom: 8, backgroundColor: '#FFFFFF', borderColor: '#E4E2DA', borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, color: '#252923' },
  breadcrumb: { minHeight: 58, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  backText: { color: '#526447', fontWeight: '800' }, breadcrumbTitle: { color: '#252923', fontSize: 16, fontWeight: '800', flex: 1 },
  results: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 }, resultRow: { backgroundColor: '#FFFFFF', borderColor: '#E4E2DA', borderWidth: 1, borderRadius: 11, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultCopy: { flex: 1, gap: 3 }, itemName: { color: '#252923', fontSize: 15, fontWeight: '700' }, itemPath: { color: '#68715E', fontSize: 12 },
  chooseText: { color: '#35472F', fontWeight: '800', fontSize: 12 }, browseRow: { backgroundColor: '#FFFFFF', borderColor: '#E4E2DA', borderWidth: 1, borderRadius: 11, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { color: '#526447', fontSize: 24, fontWeight: '500' }, empty: { color: '#858A80', padding: 14, lineHeight: 20 },
  footer: { borderTopWidth: 1, borderTopColor: '#E4E2DA', padding: 16, gap: 8 }, unassigned: { padding: 12, alignItems: 'center' },
  unassignedText: { color: '#9A5147', fontWeight: '800' }, footerHint: { color: '#858A80', fontSize: 11, lineHeight: 16, textAlign: 'center' },
});