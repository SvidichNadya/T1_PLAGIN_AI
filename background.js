const api=globalThis.browser||globalThis.chrome;
api.runtime.onInstalled.addListener(()=>{try{api.sidePanel?.setOptions?.({path:"sidepanel/index.html"}).catch?.(()=>{})}catch(e){}});
if(api.action?.onClicked&&api.sidePanel?.open){
 api.action.onClicked.addListener(async tab=>{
  try{await api.sidePanel.open({windowId:tab.windowId})}
  catch(e){try{await api.sidePanel.setPanelBehavior({openPanelOnActionClick:true})}catch(_){}}
 });
}
api.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 if(!message?.type)return;
 if(message.type==="PING"){sendResponse({ok:true,version:api.runtime.getManifest().version});return}
 if(message.type==="GET_TAB"){api.tabs.query({active:true,currentWindow:true}).then(tabs=>sendResponse({ok:true,tab:tabs?.[0]?{id:tabs[0].id,url:tabs[0].url||"",title:tabs[0].title||""}:null}));return true}
 if(message.type==="SAVE_QUICK_NOTE"){(async()=>{try{const key="wc-session",x=await api.storage.session.get(key),data=x[key]||{development:{},documents:[],workTasks:[],questions:[],decisions:[],meetings:[],emails:[],notes:[]};data.notes=data.notes||[];const note={id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),title:"Быстрая заметка",text:String(message.text||""),createdAt:new Date().toISOString(),contextName:message.contextName||""};data.notes.push(note);await api.storage.session.set({[key]:data});api.runtime.sendMessage({type:"NOTE_SAVED",note}).catch(()=>{});sendResponse({ok:true})}catch(e){sendResponse({ok:false,error:String(e.message||e)})}})();return true}
});
