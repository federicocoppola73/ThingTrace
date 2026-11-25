# Archivio documenti

## Modello

Un documento è un'entità indipendente, identificata da UUID, con titolo, descrizione, tipologia, data, numero/codice, emittente, scadenza facoltativa, note e date di creazione/modifica.

Le tipologie iniziali sono fattura, ricevuta/scontrino, garanzia, manuale, contratto, certificato, documento personale, documento di consegna e altro.

Ogni documento può avere più allegati. I file originali vengono copiati nello spazio privato dell'app e registrati in `document_attachments` con nome originale, MIME type, dimensione e checksum SHA-256. Sono supportati PDF, immagini, testo e formati Office comuni. Gli allegati possono essere aperti con il visualizzatore nativo disponibile sul dispositivo.

## Collegamenti

`document_links` collega un documento a uno o più elementi:
- `ITEM`: oggetto;
- `CONTAINER`: contenitore;
- `LOCATION`: stanza/zona, luogo o posizione.

Un documento viene creato una sola volta. I collegamenti sono molti-a-molti e indipendenti dagli allegati: scollegare un elemento non cancella il documento né i suoi file. La creazione da una scheda elemento associa automaticamente il documento a quell'elemento; dalla scheda documento è possibile aggiungere o rimuovere collegamenti.

## Interfaccia

- Archivio centrale con ricerca per titolo, descrizione, numero, emittente, note e tipologia.
- Creazione e modifica dei metadati.
- Scheda documento con allegati e collegamenti.
- Importazione multipla di file dal selettore di sistema.
- Apertura degli allegati tramite anteprima nativa.
- Collegamento di documenti esistenti o creazione contestuale da oggetti, contenitori e ubicazioni.

## Migrazione

`runDocumentMigration` estende in modo idempotente la tabella `documents` già presente, senza eliminare i record legacy. Crea inoltre `document_attachments` e `document_links`. La migrazione viene eseguita da `initializeDatabase` dopo lo schema principale e le migrazioni foto/oggetti.
