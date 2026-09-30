window.WC=window.WC||{};
WC.calendar={
 normalize(t){return {title:t.title||t.text||"Рабочая задача",date:t.date||"",time:t.time||"",description:t.description||t.source||""}},
 async createOnCurrentPage(event){
  const tabs=await chrome.tabs.query({active:true,currentWindow:true});const tab=tabs[0];if(!tab||!tab.id)throw new Error("Активная вкладка недоступна");
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:["content.js"]});
  const ok=confirm("Создать событие в текущем календаре?\n\n"+event.title+"\n"+(event.date||"Дата не указана")+" "+(event.time||""));
  if(!ok)return {ok:false,cancelled:true};
  return await new Promise(resolve=>chrome.tabs.sendMessage(tab.id,{type:"CREATE_CALENDAR_EVENT",event},r=>resolve(chrome.runtime.lastError?{ok:false,error:chrome.runtime.lastError.message}:r)));
 }
};