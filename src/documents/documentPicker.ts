import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { DocumentStorage } from './documentStorage';
import { insertDocumentAttachment, listDocumentAttachments, type DocumentAttachment } from '@/repositories/documentRepository';

const DOCUMENT_MIME_TYPES = [
 'application/pdf','image/*','text/plain',
 'application/msword',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-excel',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

export async function pickDocumentAttachments(documentId:string){
 // Use Expo FileSystem's native SAF picker: it returns File handles with the
 // Android URI permission already attached, unlike a raw content:// string.
 const result=await File.pickFileAsync({multipleFiles:true,mimeTypes:DOCUMENT_MIME_TYPES});
 if(result.canceled)return{canceled:true,imported:0,failures:[] as string[]};
 const storage=new DocumentStorage();let imported=0;const failures:string[]=[];
 for(const selectedFile of result.result){
  let stored:Awaited<ReturnType<DocumentStorage['import']>>|null=null;
  try{
   stored=await storage.import(selectedFile.uri,selectedFile.name,selectedFile.type);
   const row:DocumentAttachment={...stored,documentId,createdAt:new Date().toISOString()};
   await insertDocumentAttachment(row);imported++;
  }catch(e){
   if(stored)try{await storage.removeDirectory(stored.filePath)}catch{}
   failures.push(selectedFile.name+': '+(e instanceof Error?e.message:'errore importazione'));
  }
 }
 return{canceled:false,imported,failures};
}

export async function captureDocumentPhoto(documentId:string,documentTitle:string){
 const permission=await ImagePicker.requestCameraPermissionsAsync();
 if(!permission.granted)throw Error('Permesso fotocamera negato. Consenti a ThingTrace di utilizzare la fotocamera.');
 const result=await ImagePicker.launchCameraAsync({mediaTypes:['images'],allowsEditing:false,quality:1,exif:false});
 if(result.canceled||!result.assets?.length)return{canceled:true};
 const asset=result.assets[0];
 const existing=await listDocumentAttachments(documentId);
 const photoCount=existing.filter(a=>a.mimeType.startsWith('image/')).length+1;
 const slug=documentTitle.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48)||'documento';
 const name=slug+'_'+String(photoCount).padStart(2,'0')+'.jpg';
 const storage=new DocumentStorage();
 let stored:Awaited<ReturnType<DocumentStorage['import']>>|null=null;
 try{
  stored=await storage.import(asset.uri,name,asset.mimeType||'image/jpeg');
  const row:DocumentAttachment={...stored,documentId,createdAt:new Date().toISOString()};
  await insertDocumentAttachment(row);
  return{canceled:false};
 }catch(error){
  if(stored)try{await storage.removeDirectory(stored.filePath)}catch{}
  throw error;
 }
}
