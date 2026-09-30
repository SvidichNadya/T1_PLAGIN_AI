const api=globalThis.browser||globalThis.chrome;
api.runtime.onInstalled.addListener(()=>{try{if(api.sidePanel?.setPanelBehavior)api.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>{})}catch(e){}});
api.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 if(!message?.type)return;
 if(message.type==="PING"){sendResponse({ok:true,version:api.runtime.getManifest().version});return}
 if(message.type==="GET_TAB"){api.tabs.query({active:true,currentWindow:true}).then(tabs=>sendResponse({ok:true,tab:tabs?.[0]?{id:tabs[0].id,url:tabs[0].url||"",title:tabs[0].title||""}:null}));return true}
 if(message.type==="SAVE_QUICK_NOTE"){(async()=>{try{const key="wc-session",x=await api.storage.session.get(key),data=x[key]||{notes:[],documents:[],workTasks:[],questions:[],decisions:[]};data.notes=data.notes||[];data.notes.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),title:"Быстрая заметка",text:String(message.text||""),createdAt:new Date().toISOString(),contextName:message.contextName||""});await api.storage.session.set({[key]:data});api.runtime.sendMessage({type:"NOTE_SAVED",note:data.notes[data.notes.length-1]}).catch(()=>{});sendResponse({ok:true})}catch(e){sendResponse({ok:false,error:String(e.message||e)})}})();return true}
});