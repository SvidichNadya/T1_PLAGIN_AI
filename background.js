const api=globalThis.browser||globalThis.chrome;
api.runtime.onInstalled.addListener(()=>{try{api.sidePanel?.setOptions?.({path:"sidepanel/index.html"}).catch?.(()=>{})}catch(e){}});
if(api.action?.onClicked){
 api.action.onClicked.addListener(async tab=>{
  try{
   if(tab?.id&&api.scripting?.executeScript){
    const access=classifyPage(tab.url);if(!access.ok)throw Object.assign(new Error(access.reason),{code:access.code,url:tab.url||"",title:tab.title||""});
 await api.scripting.executeScript({target:{tabId:tab.id},files:["content.js"]});
   }
  }catch(e){}
  try{
   if(api.sidePanel?.open&&tab?.windowId!=null)await api.sidePanel.open({windowId:tab.windowId});
   else if(api.sidePanel?.setPanelBehavior)await api.sidePanel.setPanelBehavior({openPanelOnActionClick:true});
  }catch(e){try{await api.sidePanel?.setPanelBehavior?.({openPanelOnActionClick:true})}catch(_){}}
 });
}
function classifyPage(url){const v=String(url||"");if(/^https?:\/\//i.test(v))return{ok:true};if(/^(chrome|edge|opera|brave|vivaldi|about|moz-extension|chrome-extension|view-source|devtools):/i.test(v))return{ok:false,code:"INTERNAL_PAGE",reason:"Эта служебная страница браузера недоступна для чтения расширением."};return{ok:false,code:"UNSUPPORTED_PAGE",reason:"Эта страница не поддерживает чтение содержимого расширением."};}
async function pageRequest(message){
 const tabs=await api.tabs.query({active:true,lastFocusedWindow:true});
 const tab=tabs?.[0];
 if(!tab?.id)throw new Error("Не удалось определить активную вкладку.");
 await api.scripting.executeScript({target:{tabId:tab.id},files:["content.js"]});
 return await new Promise((resolve,reject)=>{
  api.tabs.sendMessage(tab.id,message,response=>{
   const err=api.runtime.lastError;
   if(err){reject(new Error(err.message));return}
   resolve(response);
  });
 });
}
api.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 if(!message?.type)return;
 if(message.type==="PING"){sendResponse({ok:true,version:api.runtime.getManifest().version});return}
 if(message.type==="PAGE_REQUEST"){(async()=>{try{sendResponse(await pageRequest(message.request||{}))}catch(e){sendResponse({ok:false,error:String(e.message||e)})}})();return true}
 if(message.type==="GET_TAB"){api.tabs.query({active:true,currentWindow:true}).then(tabs=>sendResponse({ok:true,tab:tabs?.[0]?{id:tabs[0].id,url:tabs[0].url||"",title:tabs[0].title||""}:null}));return true}
 if(message.type==="SAVE_QUICK_NOTE"){(async()=>{try{const key="wc-session",x=await api.storage.session.get(key),data=x[key]||{development:{},documents:[],workTasks:[],questions:[],decisions:[],meetings:[],emails:[],notes:[]};data.notes=data.notes||[];const note={id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),title:"Быстрая заметка",text:String(message.text||""),createdAt:new Date().toISOString(),contextName:message.contextName||""};data.notes.push(note);await api.storage.session.set({[key]:data});api.runtime.sendMessage({type:"NOTE_SAVED",note}).catch(()=>{});sendResponse({ok:true})}catch(e){sendResponse({ok:false,error:String(e.message||e)})}})();return true}
});