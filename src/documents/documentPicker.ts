import * as DocumentPicker from 'expo-document-picker';
import { DocumentStorage } from './documentStorage';
import { insertDocumentAttachment, type DocumentAttachment } from '@/repositories/documentRepository';
export async function pickDocumentAttachments(documentId:string){
 const result=await DocumentPicker.getDocumentAsync({type:['application/pdf','image/*','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],multiple:true,copyToCacheDirectory:true});
 if(result.canceled)return{canceled:true,imported:0,failures:[] as string[]};
 const storage=new DocumentStorage();let imported=0;const failures:string[]=[];
 for(const asset of result.assets){let stored:Awaited<ReturnType<DocumentStorage['import']>>|null=null;try{stored=await storage.import(asset.uri,asset.name,asset.mimeType);const row:DocumentAttachment={...stored,documentId,createdAt:new Date().toISOString()};await insertDocumentAttachment(row);imported++}catch(e){if(stored)await storage.removeDirectory(stored.filePath);failures.push(asset.name+': '+(e instanceof Error?e.message:'errore importazione'))}}
 return{canceled:false,imported,failures};
}
