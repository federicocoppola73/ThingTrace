import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

const ROOT='documents';
const ALLOWED=new Set(['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
export interface StoredDocumentFile { id:string; originalName:string; filePath:string; mimeType:string; fileSize:number; checksumSha256:string }
export class DocumentStorage {
 private readonly root=new Directory(Paths.document,'thingtrace','files');
 async import(uri:string,name:string,mimeType:string|null,documentId:string):Promise<StoredDocumentFile>{
  const normalized=(mimeType||'application/octet-stream').toLowerCase();
  if(!ALLOWED.has(normalized))throw Error('Formato non supportato. Seleziona PDF, immagini, testo o documenti Office.');
  if(!uri.startsWith('file://')&&!uri.startsWith('content://'))throw Error('Il file selezionato non è accessibile.');
  const id=Crypto.randomUUID(),dir=new Directory(this.root,ROOT,id);dir.create({intermediates:true,idempotent:true});
  const extension=name.includes('.')?name.split('.').pop()!.replace(/[^a-zA-Z0-9]/g,'').toLowerCase():'bin';
  const destination=new File(dir,'original.'+extension);
  try{await new File(uri).copy(destination);const info=await destination.info();if(!info.exists||!info.size)throw Error('Il file copiato è vuoto o non disponibile.');return{id,originalName:name,filePath:ROOT+'/'+id+'/original.'+extension,mimeType:normalized,fileSize:info.size,checksumSha256:await destination.digest('SHA-256')}}catch(e){if(dir.exists)dir.delete();throw e}
 }
 getFile(path:string){const parts=path.split('/');if(parts[0]!==ROOT||parts.length!==3||parts.some(p=>!p||p==='.'||p==='..'))throw Error('Percorso allegato non valido.');return new File(this.root,...parts)}
 async remove(path:string){const file=this.getFile(path);if(file.exists)file.delete()}
 async removeDirectory(path:string){const parts=path.split('/');if(parts[0]!==ROOT||parts.length!==3)throw Error('Percorso allegato non valido.');const dir=new Directory(this.root,ROOT,parts[1]);if(dir.exists)dir.delete()}
}
