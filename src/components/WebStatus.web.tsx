import React, {useEffect,useState} from 'react';
import { View, Text, Pressable } from 'react-native';
import { snapshotState } from '../services/protectedFetch.web';
export function WebStatus() {
  const [state,setState]=useState({...snapshotState});const [worker,setWorker]=useState<ServiceWorker|null>(null);
  useEffect(()=>{
    const update=()=>setState({...snapshotState});window.addEventListener('cricbuddy-snapshot',update);
    if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').then(r=>{
      setWorker(r.waiting);r.addEventListener('updatefound',()=>{const w=r.installing;w?.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)setWorker(w);});});
    }).catch(()=>{});
    return ()=>window.removeEventListener('cricbuddy-snapshot',update);
  },[]);
  return <View style={{backgroundColor:'#fff5dc',padding:6,paddingTop:8,flexDirection:'row',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
    {state.cached?<Text>Saved {new Date(state.retrievedAt).toLocaleString()} · Offline/stale · Scores are not live</Text>:null}
    <Pressable accessibilityRole="button" onPress={()=>location.reload()}><Text>Refresh</Text></Pressable>
    {worker?<Pressable accessibilityRole="button" onPress={()=>{navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});worker.postMessage({type:'SKIP_WAITING'});}}><Text>Update available · Reload when ready</Text></Pressable>:null}
  </View>;
}
