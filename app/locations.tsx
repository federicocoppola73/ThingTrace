import { DocumentLinksSection } from '@/components/DocumentLinksSection';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  createHome, createLocation, deleteHome, deleteLocation, getHomeDeleteImpact, getLocationDeleteImpact, listHomes, listLocations,
  renameHome, renameLocation, type HomeRecord, type LocationRecord, type LocationType
} from '@/repositories/locationRepository';
import { linkDocument } from '@/repositories/documentRepository';

type Editor =
  | { kind: 'home'; mode: 'create' | 'rename'; id?: string }
  | { kind: 'location'; mode: 'create' | 'rename'; id?: string; homeId?: string; parentId?: string | null; type?: LocationType };

const TYPE_LABEL: Record<LocationType, string> = { AREA: 'Stanza/Zona', ROOM: 'Luogo', POSITION: 'Posizione' };

export default function LocationsScreen() {
  const router = useRouter();
  const { documentId } = useLocalSearchParams<{ documentId?: string }>();
  const [homes, setHomes] = useState<HomeRecord[]>([]);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [name, setName] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedHomes, setExpandedHomes] = useState<Set<string>>(new Set());
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const [nextHomes, nextLocations] = await Promise.all([listHomes(), listLocations()]);
      setHomes(nextHomes);
      setLocations(nextLocations);
    } catch (error) {
      Alert.alert('Errore ubicazioni', error instanceof Error ? error.message : 'Impossibile caricare le ubicazioni.');
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  function toggleHome(id: string) {
    setExpandedHomes((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function toggleLocation(id: string) {
    setExpandedLocations((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function associateDocument(location: LocationRecord) {
    if (!documentId) return;
    try {
      await linkDocument(documentId, { type: 'LOCATION', id: location.id });
      Alert.alert('Documento associato', `Il documento è stato collegato a ${location.homeName} · ${location.path}.`);
    } catch (error) {
      Alert.alert('Associazione non riuscita', error instanceof Error ? error.message : 'Impossibile associare il documento.');
    }
  }

  function begin(next: Editor, initialName = '') {
    setEditor(next);
    setName(initialName);
  }

  async function save() {
    if (!editor || !name.trim()) {
      Alert.alert('Nome necessario', 'Inserisci un nome prima di salvare.');
      return;
    }
    setSaving(true);
    try {
      if (editor.kind === 'home') {
        if (editor.mode === 'create') {
          const createdHomeId = await createHome(name);
          setExpandedHomes((current) => new Set(current).add(createdHomeId));
        }
        else if (editor.id) await renameHome(editor.id, name);
      } else {
        if (editor.mode === 'create' && editor.homeId && editor.type) {
          await createLocation({ homeId: editor.homeId, parentId: editor.parentId ?? null, name, type: editor.type });
          setExpandedHomes((current) => new Set(current).add(editor.homeId!));
          if (editor.parentId) setExpandedLocations((current) => new Set(current).add(editor.parentId));
        } else if (editor.mode === 'rename' && editor.id) await renameLocation(editor.id, name);
      }
      setEditor(null);
      setName('');
      await refresh();
    } catch (error) {
      Alert.alert('Operazione non riuscita', error instanceof Error ? error.message : 'Errore imprevisto.');
    } finally { setSaving(false); }
  }

  async function confirmDeleteHome(home: HomeRecord) {
    try {
      const impact = await getHomeDeleteImpact(home.id);
      const details = impact.containers > 0
        ? `\n\nSaranno eliminate ${impact.locations} ubicazioni e scollegati ${impact.containers} contenitori. I contenitori e le loro fotografie resteranno nell'archivio, ma non avranno più un'ubicazione.`
        : `\n\nSaranno eliminate ${impact.locations} ubicazioni.`;
      Alert.alert(
        'Eliminare l’intera sede?',
        `Vuoi eliminare "${home.name}" e tutte le sue stanze/zone, luoghi e posizioni?${details}\n\nQuesta operazione non può essere annullata.`,
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Elimina tutta la sede', style: 'destructive', onPress: async () => {
            try { await deleteHome(home.id); await refresh(); }
            catch (error) { Alert.alert('Impossibile eliminare', error instanceof Error ? error.message : 'Errore imprevisto.'); }
          } }
        ]
      );
    } catch (error) {
      Alert.alert('Errore', error instanceof Error ? error.message : 'Impossibile verificare gli elementi collegati.');
    }
  }

  async function confirmDeleteLocation(location: LocationRecord) {
    try {
      const impact = await getLocationDeleteImpact(location.id);
      const label = TYPE_LABEL[location.type].toLowerCase();
      const details = impact.locations > 1
        ? `\n\nSaranno eliminate ${impact.locations} ubicazioni, inclusi tutti i livelli sottostanti.`
        : '\n\nSarà eliminata questa ubicazione.';
      const containerDetails = impact.containers > 0
        ? `\nSaranno scollegati ${impact.containers} contenitori. I contenitori e le loro fotografie resteranno nell'archivio, ma non avranno più un'ubicazione.`
        : '';
      Alert.alert(
        `Eliminare ${label}?`,
        `Vuoi eliminare "${location.name}" e il relativo ramo?${details}${containerDetails}\n\nQuesta operazione non può essere annullata.`,
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Elimina', style: 'destructive', onPress: async () => {
            try { await deleteLocation(location.id); await refresh(); }
            catch (error) { Alert.alert('Impossibile eliminare', error instanceof Error ? error.message : 'Errore imprevisto.'); }
          } }
        ]
      );
    } catch (error) {
      Alert.alert('Errore', error instanceof Error ? error.message : 'Impossibile verificare gli elementi collegati.');
    }
  }

  function renderLocation(location: LocationRecord, homeId: string, depth: number): ReactNode {
    return (
      <View key={location.id} style={[styles.locationCard, { marginLeft: depth * 14 }]}>
        <View style={styles.locationHeader}>
          <Pressable onPress={() => toggleLocation(location.id)} style={{ flex: 1 }}>
            <Text style={styles.locationType}>{TYPE_LABEL[location.type].toUpperCase()} · {expandedLocations.has(location.id) ? 'APERTO' : 'CHIUSO'}</Text>
            <Text style={styles.locationName}>{location.name}</Text>
          </Pressable>
          {documentId ? <Pressable onPress={() => associateDocument(location)} style={styles.smallAction}><Text style={styles.actionText}>Associa documento</Text></Pressable> : null}
          <Pressable onPress={() => begin({ kind: 'location', mode: 'rename', id: location.id }, location.name)} style={styles.smallAction}><Text style={styles.actionText}>Rinomina</Text></Pressable>
          <Pressable onPress={() => confirmDeleteLocation(location)} style={styles.smallAction}><Text style={styles.deleteText}>×</Text></Pressable>
        </View>
        {expandedLocations.has(location.id) ? <>
        <DocumentLinksSection entity={{ type: 'LOCATION', id: location.id }} hideWhenEmpty />
        {location.type === 'AREA' ? (
          <Pressable style={styles.addChild} onPress={() => begin({ kind: 'location', mode: 'create', homeId, parentId: location.id, type: 'ROOM' })}>
            <Text style={styles.addChildText}>＋ Aggiungi luogo</Text>
          </Pressable>
        ) : null}
        {location.type === 'ROOM' ? (
          <Pressable style={styles.addChild} onPress={() => begin({ kind: 'location', mode: 'create', homeId, parentId: location.id, type: 'POSITION' })}>
            <Text style={styles.addChildText}>＋ Aggiungi posizione</Text>
          </Pressable>
        ) : null}
        {locations.filter((child) => child.parentId === location.id).map((child) =>
          renderLocation(child, homeId, depth + 1)
        )}
        </> : null}
      </View>
    );
  }

  if (loading) return <View style={styles.center}><Text>Caricamento ubicazioni...</Text></View>;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.intro}>Organizza dove conservi contenitori e oggetti. La struttura è: sede → stanza/zona → luogo → posizione.</Text>

      {editor ? (
        <View style={styles.editor}>
          <Text style={styles.editorTitle}>
            {editor.mode === 'create' ? 'Nuova ' : 'Rinomina '}
            {editor.kind === 'home' ? 'sede' : editor.type ? TYPE_LABEL[editor.type].toLowerCase() : 'ubicazione'}
          </Text>
          <TextInput value={name} onChangeText={setName} placeholder="Inserisci un nome" style={styles.input} autoFocus />
          <View style={styles.editorActions}>
            <Pressable onPress={() => { setEditor(null); setName(''); }} style={styles.cancel}><Text style={styles.cancelText}>Annulla</Text></Pressable>
            <Pressable disabled={saving} onPress={save} style={styles.save}><Text style={styles.saveText}>{saving ? 'Salvataggio...' : 'Salva'}</Text></Pressable>
          </View>
        </View>
      ) : null}

      {homes.map((home) => {
        const areas = locations.filter((location) => location.homeId === home.id && location.type === 'AREA');
        return (
          <View key={home.id} style={styles.homeCard}>
            <View style={styles.homeHeader}>
              <Pressable onPress={() => toggleHome(home.id)} style={{ flex: 1 }}>
                <Text style={styles.homeLabel}>SEDE · {expandedHomes.has(home.id) ? 'APERta'.toUpperCase() : 'CHIUSA'}</Text>
                <Text style={styles.homeName}>{home.name}</Text>
              </Pressable>
              <Pressable onPress={() => begin({ kind: 'home', mode: 'rename', id: home.id }, home.name)} style={styles.smallAction}><Text style={styles.actionText}>Rinomina</Text></Pressable>
              <Pressable onPress={() => confirmDeleteHome(home)} style={styles.smallAction}><Text style={styles.deleteText}>×</Text></Pressable>
            </View>
            {expandedHomes.has(home.id) ? <>
              <Pressable style={styles.addArea} onPress={() => begin({ kind: 'location', mode: 'create', homeId: home.id, parentId: null, type: 'AREA' })}>
                <Text style={styles.addAreaText}>＋ Aggiungi stanza/zona</Text>
              </Pressable>
              {areas.map((area) => renderLocation(area, home.id, 0))}
              {areas.length === 0 ? <Text style={styles.emptyText}>Nessuna stanza/zona. Aggiungi ad esempio Garage, Cucina, Ufficio o Giardino.</Text> : null}
            </> : <Text style={styles.emptyText}>Apri la sede per visualizzare o creare stanze e livelli interni.</Text>}
          </View>
        );
      })}

      {homes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nessuna sede configurata</Text>
          <Text style={styles.emptyText}>Crea una sede, ad esempio Casa, Ufficio o Magazzino. Poi potrai aggiungere stanze/zone, luoghi e posizioni.</Text>
        </View>
      ) : null}

      <Pressable style={styles.primary} onPress={() => begin({ kind: 'home', mode: 'create' })}>
        <Text style={styles.primaryText}>＋  Crea sede</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  intro: { color: '#68715E', lineHeight: 21, marginBottom: 20 },
  editor: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DADFD3', borderRadius: 16, padding: 16, marginBottom: 18 },
  editorTitle: { color: '#252923', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  input: { backgroundColor: '#FFFFFF', borderColor: '#E4E2DA', borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, color: '#252923' },
  editorActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 12 },
  cancel: { padding: 12 },
  cancelText: { color: '#68715E', fontWeight: '700' },
  save: { backgroundColor: '#43533C', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  saveText: { color: '#FFFFFF', fontWeight: '800' },
  homeCard: { backgroundColor: '#FFFFFF', borderRadius: 17, borderWidth: 1, borderColor: '#E8E6DE', padding: 15, marginBottom: 14 },
  homeHeader: { flexDirection: 'row', alignItems: 'center' },
  homeLabel: { color: '#818779', fontSize: 10, letterSpacing: 1.2, fontWeight: '800' },
  homeName: { color: '#252923', fontSize: 19, fontWeight: '800', marginTop: 3 },
  smallAction: { paddingHorizontal: 8, paddingVertical: 7 },
  actionText: { color: '#526447', fontSize: 12, fontWeight: '700' },
  deleteText: { color: '#A33D32', fontSize: 21, fontWeight: '700' },
  addArea: { backgroundColor: '#EEF0E8', borderRadius: 10, padding: 11, alignItems: 'center', marginTop: 13 },
  addAreaText: { color: '#43533C', fontWeight: '800', fontSize: 13 },
  locationCard: { borderLeftWidth: 2, borderLeftColor: '#DDE2D5', paddingLeft: 10, marginTop: 12 },
  locationHeader: { flexDirection: 'row', alignItems: 'center' },
  locationType: { color: '#8A907F', fontSize: 9, letterSpacing: 1, fontWeight: '800' },
  locationName: { color: '#30352D', fontSize: 15, fontWeight: '700', marginTop: 2 },
  addChild: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 5 },
  addChildText: { color: '#526447', fontSize: 12, fontWeight: '700' },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#DADFD3', borderRadius: 16, padding: 22, alignItems: 'center' },
  emptyTitle: { color: '#30352D', fontWeight: '800', fontSize: 16 },
  emptyText: { color: '#777D72', lineHeight: 20, marginTop: 8, fontSize: 12 },
  primary: { backgroundColor: '#43533C', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
