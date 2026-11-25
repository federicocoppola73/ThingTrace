import { useCallback,useMemo,useState } from 'react';
import type { ReactNode } from 'react';
import { useFocusEffect,useLocalSearchParams,useRouter } from 'expo-router';
import { Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View } from 'react-native';
import { getDocument,linkDocument,type DocumentEntity } from '@/repositories/documentRepository';
import { listItems,type ItemSummary } from '@/repositories/itemRepository';
import { listContainers,type ContainerSummary } from '@/repositories/containerRepository';
import { listLocations,type LocationRecord } from '@/repositories/locationRepository';

export default function LinkDocumentScreen(){
 const {id}=useLocalSearchParams<{id:string}>(),router=useRouter();
 const [query,setQuery]=useState('');
 const [title,setTitle]=useState('');
 const [items,setItems]=useState<ItemSummary[]>([]);
 const [containers,setContainers]=useState<ContainerSummary[]>([]);
 const [locations,setLocations]=useState<LocationRecord[]>([]);
 const [busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{
  if(!id)return;
  try{
   const [doc,itemRows,containerRows,locationRows]=await Promise.all([getDocument(id),listItems(),listContainers(),listLocations()]);
   setTitle(doc?.title??'');setItems(itemRows);setContainers(containerRows);setLocations(locationRows);
  }catch(e){Alert.alert('Errore caricamento',e instanceof Error?e.message:'Impossibile caricare le entità.')}
 },[id]);
 useFocusEffect(useCallback(()=>{refresh()},[refresh]));
 const q=query.trim().toLocaleLowerCase();
 const matches=(...values:(string|null|undefined)[])=>!q||values.some(v=>v?.toLocaleLowerCase().includes(q));
 const visibleItems=useMemo(()=>items.filter(x=>matches(x.name,x.description,x.notes)),[items,q]);
 const visibleContainers=useMemo(()=>containers.filter(x=>matches(x.name,x.locationName,x.notes)),[containers,q]);
 const visibleLocations=useMemo(()=>locations.filter(x=>matches(x.name,x.path,x.homeName)),[locations,q]);
 async function attach(entity:DocumentEntity,label:string){
  if(!id||busy)return;setBusy(true);
  try{await linkDocument(id,entity);Alert.alert('Collegamento aggiunto',title+' è collegato a '+label+'.',[{text:'OK',onPress:()=>router.back()}])}
  catch(e){Alert.alert('Collegamento non riuscito',e instanceof Error?e.message:'Impossibile collegare il documento.')}
  finally{setBusy(false)}
 }
 function section(label:string,count:number,children:ReactNode){return <View style={s.section}><View style={s.sectionHead}><Text style={s.sectionTitle}>{label}</Text><Text style={s.count}>{count}</Text></View>{children}</View>}
 function row(label:string,detail:string,onPress:()=>void,key:string){return <Pressable key={key} disabled={busy} style={s.row} onPress={onPress}><View style={{flex:1}}><Text style={s.name}>{label}</Text>{detail?<Text style={s.meta}>{detail}</Text>:null}</View><Text style={s.add}>＋</Text></Pressable>}
 return <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
  <Text style={s.eyebrow}>COLLEGAMENTI</Text><Text style={s.title}>Associa documento</Text><Text style={s.subtitle}>Documento: {title||'Caricamento...'}. Puoi collegarlo a più oggetti, contenitori e luoghi. Il documento e i suoi allegati restano unici nell’archivio.</Text>
  <TextInput value={query} onChangeText={setQuery} placeholder="Cerca per nome o ubicazione" style={s.search}/>
  {section('Oggetti',visibleItems.length,visibleItems.length?visibleItems.map(x=>row(x.name,x.currentContainerName||x.currentLocationName||'Non assegnato',()=>attach({type:'ITEM',id:x.id},x.name),'i'+x.id)):<Text style={s.empty}>Nessun oggetto trovato.</Text>)}
  {section('Contenitori',visibleContainers.length,visibleContainers.length?visibleContainers.map(x=>row(x.name,x.locationName||'Ubicazione non assegnata',()=>attach({type:'CONTAINER',id:x.id},x.name),'c'+x.id)):<Text style={s.empty}>Nessun contenitore trovato.</Text>)}
  {section('Luoghi e posizioni',visibleLocations.length,visibleLocations.length?visibleLocations.map(x=>row(x.name,x.homeName+' · '+x.path,()=>attach({type:'LOCATION',id:x.id},x.homeName+' · '+x.path),'l'+x.id)):<Text style={s.empty}>Nessun luogo trovato.</Text>)}
  <Text style={s.foot}>Se il documento è già collegato a un’entità, il collegamento non viene duplicato.</Text>
 </ScrollView>
}
const s=StyleSheet.create({page:{padding:22,paddingBottom:60},eyebrow:{fontSize:10,letterSpacing:1.2,fontWeight:'800',color:'#747A6E'},title:{fontSize:25,fontWeight:'800',color:'#252923',marginTop:7},subtitle:{color:'#777D73',lineHeight:20,marginTop:9,marginBottom:17},search:{backgroundColor:'#FFF',borderColor:'#E4E2DA',borderWidth:1,borderRadius:12,padding:14,color:'#252923'},section:{marginTop:23},sectionHead:{flexDirection:'row',alignItems:'center',marginBottom:9},sectionTitle:{flex:1,fontSize:18,fontWeight:'800',color:'#252923'},count:{color:'#777D73'},row:{backgroundColor:'#FFF',borderRadius:12,borderWidth:1,borderColor:'#ECEAE3',padding:13,marginBottom:7,flexDirection:'row',alignItems:'center'},name:{fontWeight:'800',color:'#252923'},meta:{fontSize:12,color:'#7B8077',marginTop:4},add:{fontSize:20,fontWeight:'800',color:'#43533C',paddingHorizontal:5},empty:{padding:14,color:'#777D73',fontSize:13},foot:{fontSize:12,color:'#777D73',lineHeight:18,marginTop:22}});
