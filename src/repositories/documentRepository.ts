import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/database/database';

export type DocumentCategory = 'INVOICE'|'RECEIPT'|'WARRANTY'|'MANUAL'|'CONTRACT'|'CERTIFICATE'|'IDENTITY'|'DELIVERY'|'OTHER';
export type DocumentEntity = { type: 'ITEM'|'CONTAINER'|'LOCATION'; id: string };
export interface DocumentRecord { id:string; title:string; description:string|null; category:DocumentCategory; documentDate:string|null; documentNumber:string|null; issuer:string|null; expiresAt:string|null; notes:string|null; createdAt:string; updatedAt:string; attachmentCount:number; linkCount:number }
export interface DocumentAttachment { id:string; documentId:string; originalName:string; filePath:string; mimeType:string; fileSize:number; checksumSha256:string; createdAt:string }
export interface DocumentLink { id:string; documentId:string; entityType:DocumentEntity['type']; entityId:string; entityLabel:string; createdAt:string }
type DocumentRow={id:string;title:string;description:string|null;category:DocumentCategory;document_date:string|null;document_number:string|null;issuer:string|null;expires_at:string|null;notes:string|null;created_at:string;updated_at:string;attachment_count:number;link_count:number};
const mapDocument=(r:DocumentRow):DocumentRecord=>({id:r.id,title:r.title,description:r.description,category:r.category,documentDate:r.document_date,documentNumber:r.document_number,issuer:r.issuer,expiresAt:r.expires_at,notes:r.notes,createdAt:r.created_at,updatedAt:r.updated_at,attachmentCount:Number(r.attachment_count),linkCount:Number(r.link_count)});
const SELECT=`SELECT d.*,(SELECT COUNT(*) FROM document_attachments a WHERE a.document_id=d.id) AS attachment_count,(SELECT COUNT(*) FROM document_links l WHERE l.document_id=d.id) AS link_count FROM documents d`;
export async function listDocuments(search=''):Promise<DocumentRecord[]>{
 const db=await getDatabase(),q=search.trim().toLocaleLowerCase();
 const rows=await db.getAllAsync<DocumentRow>(SELECT+(q?" WHERE lower(d.title) LIKE ? OR lower(coalesce(d.description,'')) LIKE ? OR lower(coalesce(d.document_number,'')) LIKE ? OR lower(coalesce(d.issuer,'')) LIKE ? OR lower(coalesce(d.notes,'')) LIKE ? OR lower(d.category) LIKE ?":'')+' ORDER BY d.updated_at DESC',...(q?Array(6).fill('%'+q+'%'):[]));
 return rows.map(mapDocument);
}
export async function getDocument(id:string){const db=await getDatabase();const row=await db.getFirstAsync<DocumentRow>(SELECT+' WHERE d.id=?',id);return row?mapDocument(row):null}
export async function createDocument(input:{title:string;description:string|null;category:DocumentCategory;documentDate:string|null;documentNumber:string|null;issuer:string|null;expiresAt:string|null;notes:string|null},entity?:DocumentEntity){
 const title=input.title.trim();if(!title)throw Error('Inserisci il titolo del documento.');
 const db=await getDatabase(),id=Crypto.randomUUID(),now=new Date().toISOString();
 await db.withTransactionAsync(async()=>{await db.runAsync('INSERT INTO documents(id,title,description,category,document_date,document_number,issuer,expires_at,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,title,input.description?.trim()||null,input.category,input.documentDate||null,input.documentNumber?.trim()||null,input.issuer?.trim()||null,input.expiresAt||null,input.notes?.trim()||null,now,now);if(entity)await linkDocumentInTransaction(db,id,entity,now)});
 return id;
}
export async function updateDocument(id:string,input:{title:string;description:string|null;category:DocumentCategory;documentDate:string|null;documentNumber:string|null;issuer:string|null;expiresAt:string|null;notes:string|null}){
 const title=input.title.trim();if(!title)throw Error('Inserisci il titolo del documento.');
 const db=await getDatabase(),r=await db.runAsync('UPDATE documents SET title=?,description=?,category=?,document_date=?,document_number=?,issuer=?,expires_at=?,notes=?,updated_at=? WHERE id=?',title,input.description?.trim()||null,input.category,input.documentDate||null,input.documentNumber?.trim()||null,input.issuer?.trim()||null,input.expiresAt||null,input.notes?.trim()||null,new Date().toISOString(),id);
 if(!r.changes)throw Error('Documento non trovato.');
}
async function resolveEntityLabel(db:Awaited<ReturnType<typeof getDatabase>>,entity:DocumentEntity):Promise<string>{
 if(entity.type==='ITEM'){const r=await db.getFirstAsync<{name:string}>('SELECT name FROM items WHERE id=?',entity.id);if(!r)throw Error('Oggetto non trovato.');return r.name}
 if(entity.type==='CONTAINER'){const r=await db.getFirstAsync<{name:string}>('SELECT name FROM containers WHERE id=?',entity.id);if(!r)throw Error('Contenitore non trovato.');return r.name}
 const r=await db.getFirstAsync<{label:string}>(`WITH RECURSIVE p(id,home_id,path) AS(SELECT id,home_id,name FROM locations WHERE parent_id IS NULL UNION ALL SELECT l.id,l.home_id,p.path||' › '||l.name FROM locations l JOIN p ON l.parent_id=p.id) SELECT h.name||' · '||p.path AS label FROM p JOIN homes h ON h.id=p.home_id WHERE p.id=?`,entity.id);if(!r)throw Error('Ubicazione non trovata.');return r.label;
}
async function linkDocumentInTransaction(db:Awaited<ReturnType<typeof getDatabase>>,documentId:string,entity:DocumentEntity,now:string){
 const label=await resolveEntityLabel(db,entity);
 await db.runAsync('INSERT OR IGNORE INTO document_links(id,document_id,entity_type,entity_id,entity_label,created_at) VALUES(?,?,?,?,?,?)',Crypto.randomUUID(),documentId,entity.type,entity.id,label,now);
}
export async function linkDocument(documentId:string,entity:DocumentEntity){const db=await getDatabase();await db.withTransactionAsync(async()=>{await linkDocumentInTransaction(db,documentId,entity,new Date().toISOString())})}
export async function unlinkDocument(documentId:string,entity:DocumentEntity){const db=await getDatabase();await db.runAsync('DELETE FROM document_links WHERE document_id=? AND entity_type=? AND entity_id=?',documentId,entity.type,entity.id)}
export async function listDocumentLinks(documentId:string):Promise<DocumentLink[]>{const db=await getDatabase();const rows=await db.getAllAsync<any>('SELECT * FROM document_links WHERE document_id=? ORDER BY created_at',documentId);return rows.map(r=>({id:r.id,documentId:r.document_id,entityType:r.entity_type,entityId:r.entity_id,entityLabel:r.entity_label,createdAt:r.created_at}))}
export async function listLinkedDocuments(entity:DocumentEntity):Promise<DocumentRecord[]>{const db=await getDatabase();const rows=await db.getAllAsync<DocumentRow>(SELECT+' JOIN document_links l ON l.document_id=d.id WHERE l.entity_type=? AND l.entity_id=? ORDER BY d.updated_at DESC',entity.type,entity.id);return rows.map(mapDocument)}
export async function listDocumentAttachments(documentId:string):Promise<DocumentAttachment[]>{const db=await getDatabase();const rows=await db.getAllAsync<any>('SELECT * FROM document_attachments WHERE document_id=? ORDER BY created_at',documentId);return rows.map(r=>({id:r.id,documentId:r.document_id,originalName:r.original_name,filePath:r.file_path,mimeType:r.mime_type,fileSize:r.file_size,checksumSha256:r.checksum_sha256,createdAt:r.created_at}))}
export async function deleteDocument(id:string){const db=await getDatabase();await db.runAsync('DELETE FROM documents WHERE id=?',id)}
export async function insertDocumentAttachment(a:DocumentAttachment){const db=await getDatabase();await db.runAsync('INSERT INTO document_attachments(id,document_id,original_name,file_path,mime_type,file_size,checksum_sha256,created_at) VALUES(?,?,?,?,?,?,?,?)',a.id,a.documentId,a.originalName,a.filePath,a.mimeType,a.fileSize,a.checksumSha256,a.createdAt)}
export async function deleteDocumentAttachment(id:string){const db=await getDatabase();await db.runAsync('DELETE FROM document_attachments WHERE id=?',id)}
