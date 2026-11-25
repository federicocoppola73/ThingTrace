import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { DocumentStorage } from './documentStorage';
import { insertDocumentAttachment, type DocumentAttachment } from '@/repositories/documentRepository';

export async function pickDocumentAttachments(documentId:string){
 const result=await DocumentPicker.getDocumentAsync({type:['application/pdf','image/*','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],multiple:true,copyToCacheDirectory:true});
 if(result.canceled)return{canceled:true,imported:0,failures:[] as string[]};
 const storage=new DocumentStorage();let imported=0;const failures:string[]=[];
 for(const asset of result.assets){
  let stored:Awaited<ReturnType<DocumentStorage['import']>>|null=null;
  try{
   // Import immediately after selection: Android provider grants may be temporary.
   stored=await storage.import(asset.uri,asset.name,asset.mimeType);
   const row:DocumentAttachment={...stored,documentId,createdAt:new Date().toISOString()};
   await insertDocumentAttachment(row);imported++;
  }catch(e){
   if(stored)try{await storage.removeDirectory(stored.filePath)}catch{}
   failures.push(asset.name+': '+(e instanceof Error?e.message:'errore importazione'));
  }
 }
 return{canceled:false,imported,failures};
}

export async function captureDocumentPhoto(documentId:string){
 const permission=await ImagePicker.requestCameraPermissionsAsync();
 if(!permission.granted)throw Error('Permesso fotocamera negato. Consenti a ThingTrace di utilizzare la fotocamera.');
 const result=await ImagePicker.launchCameraAsync({mediaTypes:['images'],allowsEditing:false,quality:1,exif:false});
 if(result.canceled||!result.assets?.length)return{canceled:true};
 const asset=result.assets[0],name=asset.fileName||'documento-'+Date.now()+'.jpg';
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
