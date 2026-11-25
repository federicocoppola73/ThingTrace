# Gestione sedi e ubicazioni

ThingTrace usa una gerarchia locale per descrivere dove sono conservati i contenitori:

1. **Sede** (`homes`): Casa, Ufficio, Magazzino.
2. **Area** (`locations.location_type = AREA`): Garage, Piano terra, Archivio.
3. **Stanza** (`ROOM`): Cucina, Camera, Ufficio amministrativo.
4. **Posizione** (`POSITION`): Armadio 2, Scaffale B, Ripiano 3.

Le sedi e le ubicazioni sono archiviate in SQLite. Ogni ubicazione appartiene a una sede; le stanze appartengono a un'area e le posizioni a una stanza. Il repository verifica la gerarchia prima dell'inserimento.

I contenitori usano il campo esistente `containers.location_id`. L'ubicazione è facoltativa e può essere assegnata durante la creazione o aggiornata dalla schermata di modifica del contenitore. La lista e il dettaglio mostrano il percorso completo della sede e dell'ubicazione.

## Regole di eliminazione

- Una sede può essere eliminata solo quando non contiene ubicazioni.
- Un'ubicazione può essere eliminata solo quando non contiene ubicazioni figlie e non è assegnata a contenitori.
- Per spostare un contenitore, aprire la modifica del contenitore e selezionare una nuova ubicazione oppure "Non assegnata".

## File principali

- `src/repositories/locationRepository.ts`: lettura, creazione, rinomina ed eliminazione di sedi e ubicazioni.
- `app/locations.tsx`: interfaccia di gestione gerarchica.
- `src/repositories/containerRepository.ts`: associazione e lettura del percorso ubicazione dei contenitori.

La struttura riutilizza le tabelle `homes` e `locations` già presenti nello schema SQLite; non è richiesta una migrazione aggiuntiva per questa funzionalità.
