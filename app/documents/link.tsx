import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getDocument, linkDocument, type DocumentEntity } from '@/repositories/documentRepository';
import { listItems, type ItemSummary } from '@/repositories/itemRepository';
import { listContainers, type ContainerSummary } from '@/repositories/containerRepository';
import { listLocations, type LocationRecord } from '@/repositories/locationRepository';

type Section = 'items' | 'containers' | 'locations' | null;
const normalize = (value: string) => value.toLocaleLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');

export default function LinkDocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [containers, setContainers] = useState<ContainerSummary[]>([]);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [section, setSection] = useState<Section>(null);
  const [homeId, setHomeId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const [doc, itemRows, containerRows, locationRows] = await Promise.all([
        getDocument(id), listItems(), listContainers(), listLocations()
      ]);
      setTitle(doc?.title ?? '');
      setItems(itemRows);
      setContainers(containerRows);
      setLocations(locationRows);
    } catch (error) {
      Alert.alert('Errore caricamento', error instanceof Error ? error.message : 'Impossibile caricare le entità.');
    }
  }, [id]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const term = normalize(query.trim());
  const matches = (...values: (string | null | undefined)[]) =>
    !term || values.some(value => value && normalize(value).includes(term));

  const visibleItems = useMemo(
    () => items.filter(item => matches(item.name, item.description, item.notes, item.currentContainerName, item.currentLocationName)),
    [items, term]
  );
  const visibleContainers = useMemo(
    () => containers.filter(item => matches(item.name, item.locationName, item.notes)),
    [containers, term]
  );
  const visibleLocations = useMemo(
    () => locations.filter(item => matches(item.name, item.path, item.homeName)),
    [locations, term]
  );

  const homes = useMemo(() => {
    const map = new Map<string, string>();
    locations.filter(location => location.type === 'AREA').forEach(location => map.set(location.homeId, location.homeName));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'it'));
  }, [locations]);
  const browseLocations = useMemo(
    () => locations
      .filter(location => location.homeId === homeId && location.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, 'it')),
    [locations, homeId, parentId]
  );
  const currentLocation = locations.find(location => location.id === parentId);
  const currentHomeName = homes.find(([home]) => home === homeId)?.[1];

  async function attach(entity: DocumentEntity, label: string) {
    if (!id || busy) return;
    setBusy(true);
    try {
      await linkDocument(id, entity);
      router.replace({ pathname: '/documents/[id]', params: { id } });
    } catch (error) {
      Alert.alert('Collegamento non riuscito', error instanceof Error ? error.message : 'Impossibile collegare il documento.');
    } finally {
      setBusy(false);
    }
  }

  function toggle(next: Exclude<Section, null>) {
    setSection(current => current === next ? null : next);
    if (next === 'locations') {
      setHomeId(null);
      setParentId(null);
    }
  }

  function entityRow(label: string, detail: string, onPress: () => void, key: string) {
    return (
      <Pressable key={key} disabled={busy} style={s.row} onPress={onPress}>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{label}</Text>
          {!!detail && <Text style={s.meta}>{detail}</Text>}
        </View>
        <Text style={s.add}>＋</Text>
      </Pressable>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Text style={s.eyebrow}>COLLEGAMENTI</Text>
      <Text style={s.title}>Associa documento</Text>
      <Text style={s.subtitle}>
        Documento: {title || 'Caricamento...'}. Scegli una categoria e individua l’elemento da collegare. Il documento resta unico anche se associato a più elementi.
      </Text>

      <View style={s.quickActions}>
        <Pressable style={s.quickAction} onPress={() => router.push({ pathname: '/items/new', params: { documentId: id } })}>
          <Text style={s.quickIcon}>＋</Text><Text style={s.quickLabel}>Oggetto</Text>
        </Pressable>
        <Pressable style={s.quickAction} onPress={() => router.push({ pathname: '/containers/new', params: { documentId: id } })}>
          <Text style={s.quickIcon}>＋</Text><Text style={s.quickLabel}>Contenitore</Text>
        </Pressable>
        <Pressable style={s.quickAction} onPress={() => router.push({ pathname: '/locations', params: { documentId: id } })}>
          <Text style={s.quickIcon}>＋</Text><Text style={s.quickLabel}>Ubicazione</Text>
        </Pressable>
      </View>

      <TextInput value={query} onChangeText={value => { setQuery(value); setHomeId(null); setParentId(null); }} placeholder="Cerca per nome o ubicazione" style={s.search} />

      <View style={s.section}>
        <Pressable style={s.sectionHead} onPress={() => toggle('items')}>
          <Text style={s.sectionIcon}>▤</Text><Text style={s.sectionTitle}>Oggetti</Text>
          <Text style={s.count}>{visibleItems.length}</Text><Text style={s.chevron}>{section === 'items' ? '⌄' : '›'}</Text>
        </Pressable>
        {section === 'items' && (visibleItems.length
          ? visibleItems.map(item => entityRow(item.name, item.currentContainerName || item.currentLocationName || 'Non assegnato', () => attach({ type: 'ITEM', id: item.id }, item.name), 'i' + item.id))
          : <Text style={s.empty}>Nessun oggetto trovato.</Text>)}
      </View>

      <View style={s.section}>
        <Pressable style={s.sectionHead} onPress={() => toggle('containers')}>
          <Text style={s.sectionIcon}>▣</Text><Text style={s.sectionTitle}>Contenitori</Text>
          <Text style={s.count}>{visibleContainers.length}</Text><Text style={s.chevron}>{section === 'containers' ? '⌄' : '›'}</Text>
        </Pressable>
        {section === 'containers' && (visibleContainers.length
          ? visibleContainers.map(item => entityRow(item.name, item.locationName || 'Ubicazione non assegnata', () => attach({ type: 'CONTAINER', id: item.id }, item.name), 'c' + item.id))
          : <Text style={s.empty}>Nessun contenitore trovato.</Text>)}
      </View>

      <View style={s.section}>
        <Pressable style={s.sectionHead} onPress={() => toggle('locations')}>
          <Text style={s.sectionIcon}>⌂</Text><Text style={s.sectionTitle}>Ubicazioni</Text>
          <Text style={s.count}>{visibleLocations.length}</Text><Text style={s.chevron}>{section === 'locations' ? '⌄' : '›'}</Text>
        </Pressable>
        {section === 'locations' && (term ? (
          visibleLocations.length
            ? visibleLocations.map(item => entityRow(item.name, item.homeName + ' · ' + item.path, () => attach({ type: 'LOCATION', id: item.id }, item.name), 'l' + item.id))
            : <Text style={s.empty}>Nessuna ubicazione trovata.</Text>
        ) : (
          <>
            <View style={s.breadcrumb}>
              {homeId && <Pressable onPress={() => { setHomeId(null); setParentId(null); }}><Text style={s.back}>‹ Sedi</Text></Pressable>}
              {parentId && <Pressable onPress={() => setParentId(currentLocation?.parentId ?? null)}><Text style={s.back}>‹ Indietro</Text></Pressable>}
              <Text style={s.breadcrumbTitle}>{currentLocation?.name ?? currentHomeName ?? 'Seleziona una sede'}</Text>
            </View>
            {!homeId ? homes.map(([home, name]) => (
              <Pressable key={home} style={s.row} onPress={() => { setHomeId(home); setParentId(null); }}>
                <Text style={s.name}>{name}</Text><Text style={s.open}>Apri ›</Text>
              </Pressable>
            )) : browseLocations.map(location => (
              <View key={location.id} style={s.row}>
                <Pressable style={{ flex: 1 }} onPress={() => location.type !== 'POSITION' && setParentId(location.id)}>
                  <Text style={s.name}>{location.name}</Text>
                  <Text style={s.meta}>{location.type === 'AREA' ? 'Stanza/Zona' : location.type === 'ROOM' ? 'Luogo' : 'Posizione'}</Text>
                </Pressable>
                <Pressable disabled={busy} onPress={() => attach({ type: 'LOCATION', id: location.id }, location.name)}><Text style={s.add}>＋</Text></Pressable>
                {location.type !== 'POSITION' && <Pressable onPress={() => setParentId(location.id)}><Text style={s.open}>Apri ›</Text></Pressable>}
              </View>
            ))}
            {homeId && browseLocations.length === 0 && <Text style={s.empty}>Nessuna ubicazione in questo livello.</Text>}
          </>
        ))}
      </View>

      <Text style={s.foot}>Se il documento è già collegato a un elemento, il collegamento non viene duplicato.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { padding: 22, paddingBottom: 60 },
  quickActions: { flexDirection: 'row', gap: 9, marginBottom: 15 },
  quickAction: { flex: 1, backgroundColor: '#EEF0E8', borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  quickIcon: { fontSize: 22, fontWeight: '800', color: '#43533C', lineHeight: 25 },
  quickLabel: { fontSize: 12, fontWeight: '800', color: '#43533C', marginTop: 3 },
  eyebrow: { fontSize: 10, letterSpacing: 1.2, fontWeight: '800', color: '#747A6E' },
  title: { fontSize: 25, fontWeight: '800', color: '#252923', marginTop: 7 },
  subtitle: { color: '#777D73', lineHeight: 20, marginTop: 9, marginBottom: 17 },
  search: { backgroundColor: '#FFF', borderColor: '#E4E2DA', borderWidth: 1, borderRadius: 12, padding: 14, color: '#252923' },
  section: { marginTop: 14, backgroundColor: '#FFF', borderColor: '#E8E6DE', borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 3 },
  sectionHead: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 25, color: '#526447', fontSize: 19, textAlign: 'center' },
  sectionTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#252923' },
  count: { color: '#777D73', fontSize: 12 },
  chevron: { color: '#526447', fontSize: 23, paddingHorizontal: 5 },
  row: { backgroundColor: '#FAFAF7', borderRadius: 10, borderWidth: 1, borderColor: '#ECEAE3', padding: 12, marginBottom: 7, flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontWeight: '800', color: '#252923', flexShrink: 1 },
  meta: { fontSize: 12, color: '#7B8077', marginTop: 4 },
  add: { fontSize: 20, fontWeight: '800', color: '#43533C', paddingHorizontal: 5 },
  empty: { padding: 14, color: '#777D73', fontSize: 13 },
  breadcrumb: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { color: '#526447', fontWeight: '800' },
  breadcrumbTitle: { flex: 1, color: '#252923', fontWeight: '800' },
  open: { color: '#526447', fontWeight: '800', paddingHorizontal: 5 },
  foot: { fontSize: 12, color: '#777D73', lineHeight: 18, marginTop: 22 }
});
