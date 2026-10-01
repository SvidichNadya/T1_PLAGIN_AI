importScripts("core/domain-policy.js");
const api=globalThis.browser||globalThis.chrome;
const CONTENT_SCRIPT_ID="work-copilot-content";
const DYNAMIC_PREFIX="work-copilot-dynamic-";

async function loadConfig(){
  try{
    const r=await fetch("config/domains.json",{cache:"no-store"});
    if(!r.ok)throw new Error("Не удалось загрузить конфигурацию доменов.");
    globalThis.WC_DOMAIN_CONFIG=await r.json();
  }catch(e){
    globalThis.WC_DOMAIN_CONFIG={version:1,allowedDomains:[]};
    console.error("Work Copilot: configuration load failed",e);
  }
}
const CONFIG_READY=loadConfig();

function hashId(value){
  let h=0;
  for(let i=0;i<value.length;i++)h=((h<<5)-h+value.charCodeAt(i))|0;
  return DYNAMIC_PREFIX+Math.abs(h).toString(36);
}
async function registerContentScript(id,matches){
  if(!matches.length)return false;
  try{
    await api.scripting.registerContentScripts([{id,matches,js:["content.js"],runAt:"document_idle",persistAcrossSessions:true}]);
    return true;
  }catch(e){console.warn("Work Copilot: content script registration skipped",e);return false}
}
async function registerConfiguredContentScripts(){
  await CONFIG_READY;
  const patterns=WC.domainPolicy.patterns();
  try{await api.scripting.unregisterContentScripts({ids:[CONTENT_SCRIPT_ID]})}catch(_){}
  const granted=[];
  for(const pattern of patterns){
    try{if(await api.permissions.contains({origins:[pattern]}))granted.push(pattern)}catch(_){}
  }
  return registerContentScript(CONTENT_SCRIPT_ID,granted);
}
function configureSidePanel(){
  try{
    api.sidePanel?.setOptions?.({path:"sidepanel/index.html",enabled:true}).catch?.(()=>{});
    api.sidePanel?.setPanelBehavior?.({openPanelOnActionClick:true}).catch?.(()=>{});
  }catch(_){}
}
async function getActiveTab(){
  const tabs=await api.tabs.query({active:true,lastFocusedWindow:true});
  const tab=tabs?.[0];
  if(!tab?.id)throw Object.assign(new Error("Не удалось определить активную вкладку."),{code:"NO_ACTIVE_TAB"});
  return tab;
}
async function sendToTab(tabId,message){
  return await new Promise((resolve,reject)=>{
    api.tabs.sendMessage(tabId,message,response=>{
      const err=api.runtime.lastError;
      if(err){reject(new Error(err.message));return}
      resolve(response);
    });
  });
}
async function ensureContentScript(tab){
  try{return await sendToTab(tab.id,{type:"PING"})}
  catch(_){
    await api.scripting.executeScript({target:{tabId:tab.id},files:["content.js"]});
    return await sendToTab(tab.id,{type:"PING"});
  }
}
async function pageRequest(message){
  const tab=await getActiveTab();
  await CONFIG_READY;
  const trusted=WC.domainPolicy.isTrusted(tab.url);
  if(!trusted){
    const origin=WC.domainPolicy.origin(tab.url);
    if(!origin)throw Object.assign(new Error("Для этой страницы браузер не предоставляет обычного host-разрешения."),{code:"NO_WEB_ORIGIN"});
    if(!(await api.permissions.contains({origins:[origin]})))
      throw Object.assign(new Error("Для этого сайта сначала нужно разрешение пользователя."),{code:"PERMISSION_REQUIRED"});
    try{
      await api.scripting.registerContentScripts([{id:hashId(origin),matches:[origin],js:["content.js"],runAt:"document_idle",persistAcrossSessions:true}]);
    }catch(_){}
  }else{
    await registerConfiguredContentScripts();
  }
  await ensureContentScript(tab);
  return sendToTab(tab.id,message);
}
api.runtime.onInstalled.addListener(()=>{configureSidePanel();registerConfiguredContentScripts().catch(()=>{})});
api.runtime.onStartup?.addListener(()=>{configureSidePanel();registerConfiguredContentScripts().catch(()=>{})});
configureSidePanel();
if(api.action?.onClicked){
  api.action.onClicked.addListener(async tab=>{
    try{if(api.sidePanel?.open&&tab?.windowId!=null)await api.sidePanel.open({windowId:tab.windowId})}
    catch(_){try{await api.sidePanel?.setPanelBehavior?.({openPanelOnActionClick:true})}catch(__){}}
  });
}
api.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(!message?.type)return;
  if(message.type==="PING"){sendResponse({ok:true,version:api.runtime.getManifest().version});return}
  if(message.type==="GET_TAB"){
    api.tabs.query({active:true,currentWindow:true}).then(tabs=>sendResponse({ok:true,tab:tabs?.[0]?{id:tabs[0].id,url:tabs[0].url||"",title:tabs[0].title||""}:null}));
    return true;
  }
  if(message.type==="PAGE_REQUEST"){
    (async()=>{try{sendResponse(await pageRequest(message.request||{}))}
    catch(e){sendResponse({ok:false,code:e.code||"PAGE_REQUEST_FAILED",error:String(e.message||e)})}})();
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
    }catch(e){sendResponse({ok:false,error:String(e.message||e)})}})();
    return true;
  }
});
