# Gestione degli oggetti

## Dati dell'oggetto

Ogni oggetto ha un UUID stabile, nome, descrizione facoltativa, quantità, note, date di creazione/modifica e un contenitore attuale facoltativo.

Le fotografie sono archiviate tramite il modulo foto esistente e collegate all'entità `ITEM`; i file sono copiati nello spazio privato dell'app.

## Spostamenti

La tabella `item_movements` registra ogni cambio di contenitore:
- identificativo dell'evento e dell'oggetto;
- ID e nome del contenitore di provenienza;
- ID e nome del contenitore di destinazione;
- nota facoltativa;
- data e ora ISO 8601.

L'assegnazione iniziale a un contenitore crea un evento con provenienza non assegnata. La rimozione da un contenitore crea un evento con destinazione non assegnata. La creazione di un oggetto senza contenitore non genera un evento di spostamento.

L'aggiornamento del contenitore attuale e l'inserimento dell'evento avvengono nella stessa transazione SQLite. Se una delle due operazioni fallisce, entrambe vengono annullate. Se la destinazione coincide con il contenitore attuale, non viene creato un evento duplicato.

I riferimenti ai contenitori nello storico usano `ON DELETE SET NULL`, mentre i nomi sono memorizzati come snapshot. La cancellazione futura di un contenitore non cancella quindi gli eventi storici né le informazioni sul nome registrato al momento dello spostamento. Un trigger registra inoltre l'uscita dal contenitore per ogni oggetto che vi era ancora assegnato; l'azione referenziale scollega poi l'oggetto e conserva il nome storico.

## Migrazione

`src/database/runItemMigration.ts` aggiunge in modo idempotente le colonne `quantity`, `notes` e `current_container_id` alla tabella `items`, se mancanti, e crea la tabella e gli indici dello storico. Gli oggetti già presenti ricevono quantità 1 e rimangono inizialmente non assegnati.

La migrazione viene eseguita dopo la creazione delle tabelle principali e dopo la migrazione del modulo foto.

## Selezione contenitore e cancellazione

La creazione e lo spostamento di un oggetto usano un selettore contenitori con modalità Esplora (navigazione per sede e ubicazione) e Cerca (nome del contenitore o percorso ubicazione). I contenitori senza ubicazione sono disponibili alla radice e nella ricerca.

La cancellazione di un oggetto elimina anche gli eventi del suo storico. Le fotografie collegate esclusivamente a quell'oggetto vengono spostate logicamente nel cestino (il file archivio non viene cancellato); le fotografie ancora collegate ad altre entità restano attive. L'operazione è confermata esplicitamente dall'utente e non è reversibile per l'oggetto e il relativo storico.

I moduli di creazione e modifica usano una vista che si adatta alla tastiera e mantiene scorrevole il contenuto; su Android la finestra ridimensiona il layout quando compare la tastiera.
