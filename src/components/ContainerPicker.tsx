import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ContainerSummary } from '@/repositories/containerRepository';
import type { LocationRecord } from '@/repositories/locationRepository';
import type { ItemDestination } from '@/repositories/itemRepository';
type Props={containers:ContainerSummary[];locations:LocationRecord[];selected:ItemDestination;onSelect:(value:ItemDestination)=>void};
const norm=(s:string)=>s.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function ContainerPicker({containers,locations,selected,onSelect}:Props){
 const[visible,setVisible]=useState(false),[mode,setMode]=useState<'browse'|'search'>('browse'),[query,setQuery]=useState(''),[homeId,setHomeId]=useState<string|null>(null),[parentId,setParentId]=useState<string|null>(null);
 const homes=useMemo(()=>[...new Map(locations.map(x=>[x.homeId,x.homeName])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'it')),[locations]);
 const childLocations=locations.filter(x=>x.homeId===homeId&&x.parentId===parentId).sort((a,b)=>a.name.localeCompare(b.name,'it'));
 const childContainers=containers.filter(x=>parentId?x.locationId===parentId:!homeId&&x.locationId===null).sort((a,b)=>a.name.localeCompare(b.name,'it'));
 const results=useMemo(()=>{const q=norm(query.trim());if(!q)return{places:[] as LocationRecord[],boxes:[] as ContainerSummary[]};return{places:locations.filter(x=>norm(x.name+' '+x.path+' '+x.homeName).includes(q)),boxes:containers.filter(x=>norm(x.name+' '+(x.locationName??'')).includes(q))}},[query,locations,containers]);
 const currentLocation=locations.find(x=>x.id===parentId),currentHome=homes.find(x=>x[0]===homeId)?.[1];
 const selectedContainer=containers.find(x=>selected.kind==='container'&&x.id===selected.id);
 const selectedLocation=locations.find(x=>selected.kind==='location'&&x.id===selected.id);
 const label=selectedContainer?selectedContainer.name+' · '+(selectedContainer.locationName??'Senza ubicazione'):selectedLocation?selectedLocation.homeName+' · '+selectedLocation.path:'Non assegnato';
 function open(){setMode('browse');setQuery('');setHomeId(null);setParentId(null);setVisible(true)}
 function choose(value:ItemDestination){onSelect(value);setVisible(false)}
 return <><Pressable style={s.selector} onPress={open}><View style={{flex:1}}><Text style={s.small}>DESTINAZIONE</Text><Text style={s.value}>{label}</Text></View><Text style={s.action}>Scegli</Text></Pressable>
 <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setVisible(false)}><View style={s.modal}>
 <View style={s.header}><Text style={s.title}>Scegli destinazione</Text><Pressable onPress={()=>setVisible(false)}><Text style={s.action}>Chiudi</Text></Pressable></View>
 <View style={s.tabs}><Pressable onPress={()=>setMode('browse')} style={[s.tab,mode==='browse'&&s.active]}><Text>Esplora</Text></Pressable><Pressable onPress={()=>setMode('search')} style={[s.tab,mode==='search'&&s.active]}><Text>Cerca</Text></Pressable></View>
 {mode==='search'?<><TextInput value={query} onChangeText={setQuery} placeholder="Cerca contenitore o ubicazione..." style={s.search}/><ScrollView contentContainerStyle={s.list}>
 {results.places.map(x=><View key={'l'+x.id} style={s.row}><View style={{flex:1}}><Text style={s.name}>{x.name}</Text><Text style={s.meta}>{x.homeName} · {x.path}</Text></View><Pressable onPress={()=>choose({kind:'location',id:x.id})}><Text style={s.action}>Scegli</Text></Pressable></View>)}
 {results.boxes.map(x=><View key={'c'+x.id} style={s.row}><View style={{flex:1}}><Text style={s.name}>{x.name}</Text><Text style={s.meta}>{x.locationName??'Senza ubicazione'} · {x.typeLabel}</Text></View><Pressable onPress={()=>choose({kind:'container',id:x.id})}><Text style={s.action}>Scegli</Text></Pressable></View>)}
 {!query.trim()?<Text style={s.empty}>Inserisci il nome di un luogo o contenitore.</Text>:results.places.length+results.boxes.length===0?<Text style={s.empty}>Nessun risultato.</Text>:null}
 </ScrollView></>:<>
 <View style={s.crumb}>{homeId?<Pressable onPress={()=>{setHomeId(null);setParentId(null)}}><Text style={s.action}>‹ Sedi</Text></Pressable>:null}{parentId?<Pressable onPress={()=>setParentId(currentLocation?.parentId??null)}><Text style={s.action}>‹ Indietro</Text></Pressable>:null}<Text style={s.name}>{currentLocation?.name??currentHome??'Seleziona una sede'}</Text></View>
 <ScrollView contentContainerStyle={s.list}>
 {!homeId?homes.map(([id,name])=><Pressable key={id} style={s.row} onPress={()=>{setHomeId(id);setParentId(null)}}><Text style={s.name}>{name}</Text><Text style={s.action}>Apri ›</Text></Pressable>):null}
 {childLocations.map(x=><View key={x.id} style={s.row}><Pressable style={{flex:1}} onPress={()=>setParentId(x.id)}><Text style={s.name}>{x.name}</Text><Text style={s.meta}>{x.type==='AREA'?'Stanza/Zona':x.type==='ROOM'?'Luogo':'Posizione'} · Apri per esplorare</Text></Pressable><Pressable onPress={()=>choose({kind:'location',id:x.id})}><Text style={s.action}>Scegli</Text></Pressable></View>)}
 {childContainers.map(x=><View key={x.id} style={s.row}><View style={{flex:1}}><Text style={s.name}>{x.name}</Text><Text style={s.meta}>{x.typeLabel}</Text></View><Pressable onPress={()=>choose({kind:'container',id:x.id})}><Text style={s.action}>Scegli</Text></Pressable></View>)}
 {homeId&&childLocations.length===0&&childContainers.length===0?<Text style={s.empty}>Nessuna ubicazione o contenitore qui.</Text>:null}
 </ScrollView></>}
 <View style={s.footer}><Pressable onPress={()=>choose({kind:'none',id:null})}><Text style={s.remove}>Non assegnato</Text></Pressable><Text style={s.meta}>Puoi scegliere un contenitore oppure collocare direttamente l’oggetto in un’ubicazione.</Text></View>
 </View></Modal></>
}
const s=StyleSheet.create({selector:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#E4E2DA',borderRadius:12,padding:14,flexDirection:'row',alignItems:'center',gap:12},small:{fontSize:10,fontWeight:'800',color:'#858A80',letterSpacing:1},value:{fontSize:14,fontWeight:'700',color:'#35472F',marginTop:5},action:{fontWeight:'800',color:'#526447',padding:5},modal:{flex:1,backgroundColor:'#FAFAF7',paddingTop:20},header:{paddingHorizontal:20,paddingBottom:15,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},title:{fontSize:21,fontWeight:'800',color:'#252923'},tabs:{marginHorizontal:20,flexDirection:'row',backgroundColor:'#EDEEE8',borderRadius:10,padding:3},tab:{flex:1,padding:11,alignItems:'center',borderRadius:8},active:{backgroundColor:'#FFF'},search:{margin:18,padding:14,backgroundColor:'#FFF',borderRadius:10,borderWidth:1,borderColor:'#E4E2DA'},list:{paddingHorizontal:20,paddingBottom:15,gap:8},row:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#E4E2DA',borderRadius:11,padding:13,flexDirection:'row',alignItems:'center',gap:10},name:{fontWeight:'700',color:'#252923'},meta:{fontSize:12,color:'#7A8075',marginTop:4},empty:{padding:15,color:'#858A80'},crumb:{minHeight:55,paddingHorizontal:20,flexDirection:'row',alignItems:'center',gap:12},footer:{borderTopWidth:1,borderColor:'#E4E2DA',padding:16,gap:7},remove:{color:'#9A5147',fontWeight:'800',textAlign:'center',padding:8}});
