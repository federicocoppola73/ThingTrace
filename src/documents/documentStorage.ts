import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

const ROOT='documents';
const ALLOWED=new Set(['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
export interface StoredDocumentFile { id:string; originalName:string; filePath:string; mimeType:string; fileSize:number; checksumSha256:string }
export class DocumentStorage {
 private readonly root=new Directory(Paths.document,'thingtrace','files');
 async import(uri:string,name:string,mimeType:string|null|undefined):Promise<StoredDocumentFile>{
  const ext=name.split('.').pop()?.toLowerCase()||'';
  const inferred:Record<string,string>={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',heif:'image/heif',txt:'text/plain',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
  const raw=(mimeType||'').toLowerCase();
  const detected=(!raw||raw==='application/octet-stream')?(inferred[ext]||raw||'application/octet-stream'):raw;
  const normalized=detected==='image/jpg'?'image/jpeg':detected;
  if(!ALLOWED.has(normalized))throw Error('Formato non supportato. Seleziona PDF, immagini, testo o documenti Office.');
  if(!uri.startsWith('file://')&&!uri.startsWith('content://'))throw Error('Il selettore non ha restituito un percorso locale leggibile.');
  const id=Crypto.randomUUID(),dir=new Directory(this.root,ROOT,id);dir.create({intermediates:true,idempotent:true});
  const extension=name.includes('.')?name.split('.').pop()!.replace(/[^a-zA-Z0-9]/g,'').toLowerCase():'bin';
  const destination=new File(dir,'original.'+extension);
  try{
   // FileSystem File.copy reads SAF content:// handles directly. The native
   // File picker grants access to the selected URI; do not route it through
   // the legacy copyAsync API, which loses that permission on some Android providers.
   await new File(uri).copy(destination);
   const info=await destination.info();
   if(!info.exists||!info.size)throw Error('Il file copiato è vuoto o non disponibile.');
   return{id,originalName:name,filePath:ROOT+'/'+id+'/original.'+extension,mimeType:normalized,fileSize:info.size,checksumSha256:await destination.digest('SHA-256')}
  }catch(e){if(dir.exists)dir.delete();throw e}
 }
 getFile(path:string){const parts=path.split('/');if(parts[0]!==ROOT||parts.length!==3||parts.some(p=>!p||p==='.'||p==='..'))throw Error('Percorso allegato non valido.');return new File(this.root,...parts)}
 async remove(path:string){const file=this.getFile(path);if(file.exists)file.delete()}
 async removeDirectory(path:string){const parts=path.split('/');if(parts[0]!==ROOT||parts.length!==3)throw Error('Percorso allegato non valido.');const dir=new Directory(this.root,ROOT,parts[1]);if(dir.exists)dir.delete()}
}
