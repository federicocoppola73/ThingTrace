import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { listContainers, type ContainerSummary } from '@/repositories/containerRepository';

export default function HomeScreen() {
  const router = useRouter();
  const [containers, setContainers] = useState<ContainerSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const refresh = useCallback(() => {
    listContainers()
      .then(setContainers)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Errore caricamento'));
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
  const filteredContainers = containers.filter((container) => {
    const query = normalize(search);
    if (!query) return true;
    return [container.name, container.typeLabel, container.type, container.notes ?? '', container.locationName ?? '']
      .some((value) => normalize(value).includes(query));
  });

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>IL TUO ARCHIVIO PERSONALE</Text>
        <Text style={styles.title}>Trova tutto.{ '\n' }Ricorda dove.</Text>
        <Text style={styles.subtitle}>Oggetti, scatole e documenti: finalmente sai dove sono.</Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>I tuoi contenitori</Text>
        <Text style={styles.count}>{search.trim() ? `${filteredContainers.length} / ${containers.length}` : containers.length}</Text>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Cerca per nome, tipologia o note..."
          placeholderTextColor="#92968E"
          style={styles.searchInput}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Cerca contenitori per nome, tipologia o note"
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {containers.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>▤</Text>
          <Text style={styles.emptyTitle}>Il tuo archivio inizia qui</Text>
          <Text style={styles.emptyText}>Crea il primo contenitore e aggiungi una fotografia del suo contenuto.</Text>
        </View>
      ) : (
        filteredContainers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nessun contenitore trovato</Text>
            <Text style={styles.emptyText}>Prova con un altro nome, una tipologia o una parola delle note.</Text>
          </View>
        ) : filteredContainers.map((container) => (
          <Pressable key={container.id} style={styles.card} onPress={() => router.push({ pathname: '/containers/[id]', params: { id: container.id } })}>
            <View style={styles.cardIcon}><Text style={styles.cardIconText}>▤</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{container.name}</Text>
              <Text style={styles.cardMeta}>{container.typeLabel}{container.locationName ? ' · ' + container.locationName : ''}</Text>
              <Text style={styles.photoCount}>▧  {container.photoCount} {container.photoCount === 1 ? 'foto' : 'foto'}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))
      )}

      <Pressable style={styles.trashButton} onPress={() => router.push('/locations')}><Text style={styles.trashButtonText}>⌖  Gestisci sedi e ubicazioni</Text></Pressable>
      <Pressable style={styles.trashButton} onPress={() => router.push('/trash')}><Text style={styles.trashButtonText}>▤  Cestino delle fotografie</Text></Pressable>
      <Pressable style={styles.primaryButton} onPress={() => router.push('/containers/new')}>
        <Text style={styles.primaryButtonText}>＋  Crea contenitore</Text>
      </Pressable>
      <Text style={styles.footer}>I tuoi dati restano sul dispositivo.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 22, paddingTop: 54, paddingBottom: 40 },
  hero: { backgroundColor: '#E9E5D9', borderRadius: 24, padding: 24, marginBottom: 30 },
  eyebrow: { color: '#68715E', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  title: { color: '#252923', fontSize: 36, lineHeight: 39, fontWeight: '800', letterSpacing: -1.2 },
  subtitle: { color: '#5E6258', fontSize: 15, lineHeight: 22, marginTop: 14, maxWidth: 280 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E1D9', borderRadius: 14, paddingHorizontal: 13, marginBottom: 16, minHeight: 50 },
  searchIcon: { fontSize: 25, color: '#68715E', marginRight: 9 },
  searchInput: { flex: 1, color: '#252923', fontSize: 14, paddingVertical: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#252923', flex: 1 },
  count: { color: '#74796F', fontWeight: '700' },
  empty: { borderWidth: 1, borderColor: '#E3E1D9', borderStyle: 'dashed', borderRadius: 18, padding: 25, alignItems: 'center' },
  emptyIcon: { fontSize: 32, color: '#8A907F', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#30352D' },
  emptyText: { textAlign: 'center', color: '#777C72', lineHeight: 21, marginTop: 7 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#ECEAE3' },
  cardIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#EEF0E8', alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  cardIconText: { fontSize: 21, color: '#5D6B50' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#2A2F28' },
  cardMeta: { fontSize: 12, color: '#81867C', marginTop: 4 },
  photoCount: { fontSize: 12, color: '#5D6B50', fontWeight: '700', marginTop: 5 },
  chevron: { fontSize: 26, color: '#9A9E95', marginLeft: 8 },
  trashButton: { backgroundColor: '#EEF0E8', padding: 15, borderRadius: 15, alignItems: 'center', marginTop: 18 },
  trashButtonText: { color: '#43533C', fontSize: 14, fontWeight: '800' },
  primaryButton: { backgroundColor: '#43533C', padding: 17, borderRadius: 15, alignItems: 'center', marginTop: 20 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  footer: { textAlign: 'center', color: '#92968E', fontSize: 12, marginTop: 20 },
  error: { color: '#A33D32', marginBottom: 12 }
})