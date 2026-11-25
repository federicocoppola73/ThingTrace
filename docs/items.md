# Gestione degli oggetti

## Dati dell'oggetto

Ogni oggetto ha un UUID stabile, nome, descrizione facoltativa, quantità, note, date di creazione/modifica e una collocazione attuale facoltativa. La collocazione è mutuamente esclusiva: l'oggetto può essere assegnato a un contenitore, direttamente a un'ubicazione (sede/area/luogo/posizione) oppure restare non assegnato.

Le fotografie sono archiviate tramite il modulo foto esistente e collegate all'entità `ITEM`; i file sono copiati nello spazio privato dell'app.

## Spostamenti

La tabella `item_movements` registra ogni cambio di collocazione:
- identificativo dell'evento e dell'oggetto;
- ID e nome del contenitore o dell'ubicazione di provenienza;
- ID e nome/percorso del contenitore o dell'ubicazione di destinazione;
- nota facoltativa;
- data e ora ISO 8601.

L'assegnazione iniziale a una collocazione crea un evento con provenienza non assegnata. La rimozione crea un evento con destinazione non assegnata. La creazione senza collocazione non genera un evento.

L'aggiornamento della collocazione attuale e l'inserimento dell'evento avvengono nella stessa transazione SQLite. Se una delle due operazioni fallisce, entrambe vengono annullate. Se la destinazione coincide con quella attuale, non viene creato un evento duplicato.

Gli ID nello storico usano `ON DELETE SET NULL`, mentre i nomi/percorso sono memorizzati come snapshot. La cancellazione futura di un contenitore o di un'ubicazione non cancella gli eventi storici. Trigger registrano l'uscita automatica quando viene eliminato il contenitore o il luogo in cui l'oggetto era assegnato.

## Migrazione

`src/database/runItemMigration.ts` aggiunge in modo idempotente quantità, note, riferimenti alla collocazione e campi di storico. Gli oggetti già presenti ricevono quantità 1 e mantengono l'eventuale contenitore corrente; nessuna collocazione diretta viene assegnata automaticamente.

## Selezione contenitore e cancellazione

La creazione e lo spostamento usano un selettore unico con modalità Esplora e Cerca. Si può scegliere un contenitore oppure assegnare l'oggetto direttamente a una ubicazione; la ricerca trova sia contenitori sia ubicazioni. I contenitori senza ubicazione sono disponibili alla radice e nella ricerca. Nel dettaglio sono mostrate soltanto la collocazione attuale e le azioni Sposta e Rimuovi. Entrambe le operazioni richiedono conferma e sono registrate nello storico.

La cancellazione di un oggetto elimina anche gli eventi del suo storico. Le fotografie collegate esclusivamente a quell'oggetto vengono spostate logicamente nel cestino (il file archivio non viene cancellato); le fotografie ancora collegate ad altre entità restano attive. L'operazione è confermata esplicitamente dall'utente e non è reversibile per l'oggetto e il relativo storico.

I moduli di creazione e modifica usano una vista che si adatta alla tastiera e mantiene scorrevole il contenuto; su Android la finestra ridimensiona il layout quando compare la tastiera.


Quando un oggetto viene eliminato, le fotografie collegate esclusivamente a esso vengono eliminate definitivamente dal database e dall'archivio privato. Se una fotografia è condivisa con un'altra entità, viene rimossa solo l'associazione all'oggetto e il file resta disponibile all'altra entità. Le fotografie legacy già presenti nel cestino senza alcuna associazione non possono essere ripristinate senza un destinatario; possono essere eliminate definitivamente dal cestino.
