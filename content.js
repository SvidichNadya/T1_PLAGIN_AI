(() => {
  if (window.__WORK_COPILOT_CONTENT__) return;
  window.__WORK_COPILOT_CONTENT__ = true;
  const visible = el => { const s=getComputedStyle(el),r=el.getBoundingClientRect(); return s.display!=="none"&&s.visibility!=="hidden"&&r.width>0&&r.height>0; };
  const textOf = el => (el.innerText||el.textContent||"").replace(/\u00a0/g," ").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
  function extract(){
    const root=document.body;if(!root)return{title:document.title,url:location.href,text:""};
    const clone=root.cloneNode(true);clone.querySelectorAll("script,style,noscript,template,svg,canvas").forEach(x=>x.remove());
    const main=Array.from(clone.querySelectorAll("main,article,[role='main'],section")).sort((a,b)=>textOf(b).length-textOf(a).length)[0]||clone;
    return{title:document.title||"Без названия",url:location.href,text:textOf(main),selection:String(window.getSelection?window.getSelection():"").trim()};
  }
  function findLabel(words){return [...document.querySelectorAll("input,textarea,[contenteditable='true'],[role='textbox']")].filter(visible).find(el=>words.some(w=>(el.getAttribute("aria-label")||el.getAttribute("placeholder")||el.getAttribute("name")||"").toLowerCase().includes(w)))}
  function setValue(el,value){if(!el)return false;el.focus();if(el.isContentEditable)el.textContent=value;else{const p=el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;const setter=Object.getOwnPropertyDescriptor(p,"value")?.set;if(setter)setter.call(el,value);else el.value=value}el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));return true}
  function clickText(words){const e=[...document.querySelectorAll("button,a,[role='button'],input[type='button'],input[type='submit']")].filter(visible).find(x=>words.some(w=>textOf(x).toLowerCase().includes(w)));if(e){e.click();return true}return false}
  chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
    if(msg.type==="EXTRACT_PAGE"){try{sendResponse({ok:true,data:extract()})}catch(e){sendResponse({ok:false,error:String(e)})}}
    if(msg.type==="EXTRACT_SELECTION")sendResponse({ok:true,text:String(window.getSelection?window.getSelection():"").trim()});
    if(msg.type==="CREATE_CALENDAR_EVENT"){
      const e=msg.event||{};let changed=0;
      changed+=setValue(findLabel(["название","тема","title","subject"]),e.title)?1:0;
      changed+=setValue(findLabel(["дата","date"]),e.date)?1:0;
      changed+=setValue(findLabel(["время","time"]),e.time)?1:0;
      changed+=setValue(findLabel(["описание","description","комментар"]),e.description)?1:0;
      if(!changed){sendResponse({ok:false,error:"Не удалось определить поля календаря. Откройте форму создания события VK Workspace и повторите."});return}
      const submitted=clickText(["создать","сохранить","добавить событие","create","save"]);
      sendResponse({ok:true,fieldsChanged:changed,submitted});
    }
  });
})();