importScripts("config/domains.js");

const api=globalThis.browser||globalThis.chrome;
const CONTENT_SCRIPT_ID="work-copilot-content";

async function configuredOrigins(){
  return Array.isArray(globalThis.WC_DOMAIN_ALLOWLIST)?globalThis.WC_DOMAIN_ALLOWLIST.filter(Boolean):[];
}

async function registerConfiguredContentScripts(){
  const matches=await configuredOrigins();
  try{await api.scripting.unregisterContentScripts({ids:[CONTENT_SCRIPT_ID]});}catch(_){}
  if(!matches.length)return;
  await api.scripting.registerContentScripts([{
    id:CONTENT_SCRIPT_ID,
    matches,
    js:["content.js"],
    runAt:"document_idle",
    persistAcrossSessions:true
  }]);
}

async function ensureConfiguredAccess(){
  const origins=await configuredOrigins();
  if(!origins.length)return true;
  const granted=await api.permissions.contains({origins});
  if(!granted){
    const ok=await api.permissions.request({origins});
    if(!ok)return false;
  }
  await registerConfiguredContentScripts();
  return true;
}

function configureSidePanel(){
  try{
    api.sidePanel?.setOptions?.({
      path:"sidepanel/index.html",
      enabled:true
    }).catch?.(()=>{});
    api.sidePanel?.setPanelBehavior?.({
      openPanelOnActionClick:true
    }).catch?.(()=>{});
  }catch(_){}
}

api.runtime.onInstalled.addListener(()=>{
  configureSidePanel();
  registerConfiguredContentScripts().catch(()=>{});
});

api.runtime.onStartup?.addListener(()=>{
  configureSidePanel();
  registerConfiguredContentScripts().catch(()=>{});
});

configureSidePanel();

if(api.action?.onClicked){
  api.action.onClicked.addListener(async tab=>{
    try{await ensureConfiguredAccess();}catch(_){}
    try{
      if(api.sidePanel?.open&&tab?.windowId!=null)
        await api.sidePanel.open({windowId:tab.windowId});
    }catch(_){
      try{await api.sidePanel?.setPanelBehavior?.({openPanelOnActionClick:true});}catch(__){}
    }
  });
}

function classifyPage(url){
  const v=String(url||"");
  if(/^(chrome|edge|opera|brave|vivaldi|about|moz-extension|chrome-extension|view-source|devtools):/i.test(v))
    return{ok:false,code:"INTERNAL_PAGE",reason:"Эта служебная страница браузера недоступна для чтения расширением."};
  if(!/^https?:\/\//i.test(v))
    return{ok:false,code:"UNSUPPORTED_PAGE",reason:"Эта страница не поддерживает чтение содержимого расширением."};
  if(!WC_DOMAIN_ALLOWED(v))
    return{ok:false,code:"DOMAIN_NOT_ALLOWED",reason:"Домен этой страницы не входит в разрешённый список Work Copilot."};
  return{ok:true};
}

async function pageRequest(message){
  const tabs=await api.tabs.query({active:true,lastFocusedWindow:true});
  const tab=tabs?.[0];
  if(!tab?.id)throw new Error("Не удалось определить активную вкладку.");
  const access=classifyPage(tab.url);
  if(!access.ok){const e=new Error(access.reason);e.code=access.code;throw e;}
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
  if(message.type==="PAGE_REQUEST"){
    (async()=>{try{sendResponse(await pageRequest(message.request||{}));}
    catch(e){sendResponse({ok:false,code:e.code||"PAGE_REQUEST_FAILED",error:String(e.message||e)});}})();
    return true;
  }
  if(message.type==="GET_TAB"){
    api.tabs.query({active:true,currentWindow:true}).then(tabs=>sendResponse({
      ok:true,
      tab:tabs?.[0]?{id:tabs[0].id,url:tabs[0].url||"",title:tabs[0].title||""}:null
    }));
    return true;
  }
  if(message.type==="SAVE_QUICK_NOTE"){
    (async()=>{try{
      const key="wc-session",x=await api.storage.session.get(key);
      const data=x[key]||{development:{},documents:[],workTasks:[],questions:[],decisions:[],meetings:[],emails:[],notes:[]};
      data.notes=data.notes||[];
      const note={id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),title:"Быстрая заметка",text:String(message.text||""),createdAt:new Date().toISOString(),contextName:message.contextName||""};
      data.notes.push(note);
      await api.storage.session.set({[key]:data});
      api.runtime.sendMessage({type:"NOTE_SAVED",note}).catch(()=>{});
      sendResponse({ok:true});
    }catch(e){sendResponse({ok:false,error:String(e.message||e)});}})();
    return true;
  }
});
