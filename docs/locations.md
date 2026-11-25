# Gestione sedi e ubicazioni

ThingTrace usa una gerarchia locale per descrivere dove sono conservati i contenitori:

1. **Sede** (`homes`): Casa, Ufficio, Magazzino.
2. **Stanza/Zona** (`locations.location_type = AREA`): Cucina, Garage, Giardino, Ufficio.
3. **Luogo** (`ROOM`): Armadio, Scaffale, Ripostiglio, Archivio.
4. **Posizione** (`POSITION`): Ripiano 3, Cassetto superiore, Scomparto B.

Le sedi e le ubicazioni sono archiviate in SQLite. Ogni ubicazione appartiene a una sede; i luoghi appartengono a una stanza/zona e le posizioni a un luogo. I nomi tecnici dei tipi già presenti nel database (`AREA`, `ROOM`, `POSITION`) restano invariati: cambia solo la denominazione mostrata nell'interfaccia, quindi non serve migrare i dati esistenti.

I contenitori usano il campo esistente `containers.location_id`. L'ubicazione è facoltativa e può essere assegnata durante la creazione o aggiornata dalla schermata di modifica del contenitore. La lista e il dettaglio mostrano il percorso completo della sede e dell'ubicazione.

## Eliminazione di sedi e rami di ubicazioni

La cancellazione è ricorsiva: eliminare una sede rimuove tutte le sue stanze/zone, i luoghi e le posizioni; eliminare una stanza/zona o un livello inferiore rimuove anche tutte le ubicazioni discendenti.

Prima della conferma, l'app mostra quante ubicazioni e quanti contenitori sono coinvolti. Se ci sono contenitori associati, il messaggio chiarisce che:

- vengono eliminate le ubicazioni selezionate e tutte quelle sottostanti;
- i contenitori non vengono eliminati;
- i contenitori coinvolti vengono scollegati dall'ubicazione e rimangono nell'archivio, con fotografie e dati intatti;
- l'operazione non può essere annullata.

Per assegnare nuovamente un'ubicazione a un contenitore, aprire la modifica del contenitore e selezionare una nuova posizione.

## File principali

- `src/repositories/locationRepository.ts`: lettura, creazione, rinomina ed eliminazione di sedi e ubicazioni.
- `app/locations.tsx`: interfaccia di gestione gerarchica.
- `src/repositories/containerRepository.ts`: associazione e lettura del percorso ubicazione dei contenitori.

La struttura riutilizza le tabelle `homes` e `locations` già presenti nello schema SQLite; non è richiesta una migrazione aggiuntiva per questa funzionalità.
