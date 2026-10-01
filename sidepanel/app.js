const ctx=new WC.Context();let currentView="overview",agentResult=null,analysisCache=null,chatMessages=[];
async function loadDomainConfig(){const r=await fetch("../config/domains.json",{cache:"no-store"});if(!r.ok)throw Error("Не удалось загрузить конфигурацию доменов.");globalThis.WC_DOMAIN_CONFIG=await r.json()}
const $=id=>document.getElementById(id),esc=x=>WC.escape(String(x??""));
const SUPPORTED=/\.(txt|md|csv|json|xml|html?|log)$/i;
const MAX_FILE_SIZE=5*1024*1024;
async function init(){
 await ctx.ready;
 chatMessages=await WC.ai.loadHistory();
 $("clearBtn").onclick=clearContext;
 $("askAgent").onclick=()=>askAgent();
 $("agentInput").addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();askAgent()}});
 document.addEventListener("click",handleClick);
 WC.api.runtime.onMessage.addListener(async msg=>{if(msg?.type==="NOTE_SAVED"&&msg.note){if(!ctx.data.notes.some(n=>n.id===msg.note.id)){ctx.data.notes.push(msg.note);await ctx.save();render()}}});
 await rebuildAnalysis();
 render();
}
async function clearContext(){if(!confirm("Очистить текущий контекст разработки?"))return;await ctx.clear();agentResult=null;analysisCache=null;render()}
async function sendToPage(message){
 return await new Promise(resolve=>{
  WC.api.runtime.sendMessage({type:"PAGE_REQUEST",request:message},r=>{
   const err=WC.api.runtime.lastError;
   resolve(err?{ok:false,error:err.message}:r);
  });
 });
}
async function pageExtract(mode){
 const r=await sendToPage({type:"EXTRACT_PAGE"});
 if(!r?.ok){const e=Error(r?.error||"Не удалось прочитать текущую страницу.");e.code=r.code;e.title=r.title;throw e}
 return mode==="selection"?{...r.data,text:r.data.selection}:r.data;
}
async function ingest(d){
 const doc=WC.newDocument(d),a=WC.analyze.document(doc);
 Object.assign(doc,{facts:a.facts,requirements:a.requirements,questions:a.questions,decisions:a.decisions,terminology:a.terminology,status:"analyzed"});
 // tasks remain suggestions; they are not silently promoted to confirmed work tasks.
 doc.tasks=(a.tasks||[]).map(x=>({...x,suggested:true}));
 await ctx.addDocument(doc);await rebuildAnalysis();render();
}
async function rebuildAnalysis(){try{analysisCache=WC.analyze.context(ctx.data);return analysisCache}catch(e){console.error("Work Copilot: analysis failed",e);analysisCache={documents:ctx.data.documents.length,summary:[],requirements:[],questions:[],tasks:[],issues:[],decisions:[],facts:[],analysis:{error:String(e.message||e)}};return analysisCache}}
function showError(message){agentResult={text:message,state:"error"};renderAgent()}
function openTextImport(title=""){const m=$("textImportDialog");if(!m)return;m.hidden=false;$("textImportTitle").value=title;$("textImportText").value="";setTimeout(()=>$("textImportText").focus(),0)}
function closeTextImport(){$("textImportDialog").hidden=true}
async function saveTextImport(){const text=($("textImportText")?.value||"").trim();if(!text){showError("Добавьте текст источника.");return}const title=($("textImportTitle")?.value||"Локальный текст").trim()||"Локальный текст";closeTextImport();await ingest({type:"text",title,text,sourceReference:"Локально добавленный текст"})}
async function addPageOrSelection(mode){
 try{
  const tabResult=await new Promise(resolve=>WC.api.runtime.sendMessage({type:"GET_TAB"},resolve));
  const tab=tabResult?.tab;
  if(!tab?.url)throw Error("Не удалось определить текущую страницу.");
  const trusted=WC.domainPolicy.isTrusted(tab.url);
  if(!trusted){
    const origin=WC.domainPolicy.origin(tab.url);
    if(!origin)throw Object.assign(new Error("Эта страница не поддерживает динамическое разрешение доступа."),{code:"NO_WEB_ORIGIN"});
    const ok=confirm("Страница не входит в доверенный список Work Copilot.\n\nРазрешить расширению прочитать текущий сайт и добавить страницу в источник?");
    if(!ok)return;
    const access=await WC.PermissionManager.ensureDynamic(tab.url);
    if(!access.ok)throw Object.assign(new Error(access.reason),{code:access.code});
  }
  const data=await pageExtract(mode);
  if(!data.text)throw Error(mode==="selection"?"На странице сейчас ничего не выделено.":"Не удалось извлечь текст текущей страницы.");
  await ingest({type:mode==="selection"?"selection":"web",title:data.title||"Текущая страница",url:data.url,text:data.text,sourceReference:data.url});
 }catch(e){
  if(e.code==="UNSUPPORTED_PAGE"||e.code==="INJECTION_FAILED"){openTextImport(e.title||"");return}
  showError(e.message||String(e))
 }
}
function openAttachments(){
 const modal=$("attachmentsDialog");if(modal)modal.hidden=false;
}
function closeAttachments(){const modal=$("attachmentsDialog");if(modal)modal.hidden=true}
function pickFiles(folder=false){
 const input=$(folder?"folderPicker":"filePicker");if(!input)return;
 input.value="";input.click();
}
async function processFiles(fileList){
 const files=[...fileList];
 if(!files.length)return;
 const eligible=files.filter(f=>SUPPORTED.test(f.name)&&f.size<=MAX_FILE_SIZE);
 const skipped=files.length-eligible.length;
 let added=0;
 for(const f of eligible){
  try{await ingest({type:"file",title:f.webkitRelativePath||f.name,text:await f.text(),sourceReference:f.webkitRelativePath||f.name});added++}catch(e){console.warn("Work Copilot: file skipped",f.name,e)}
 }
 closeAttachments();
 if(!added)showError("Не найдено файлов, поддерживаемых локальным обработчиком. Поддерживаются TXT, MD, CSV, JSON, XML, HTML и LOG до 5 МБ.");
 else if(skipped)agentResult={text:"Добавлено файлов: "+added+". Пропущено неподдерживаемых или слишком больших: "+skipped+".",state:"ok"};
 renderAgent();
}
async function askAgent(query){
 const input=$("agentInput"),q=(query||input.value).trim();if(!q)return;
 const b=$("askAgent");b.disabled=true;
 chatMessages.push({role:"user",text:q,at:new Date().toISOString()});renderAgent();
 input.value="";
 try{
  const r=await WC.ai.ask(q,ctx.data);
  chatMessages=r.history||chatMessages.concat({role:"assistant",text:r.text||"Недостаточно данных.",at:new Date().toISOString()});
 }catch(e){
  chatMessages.push({role:"error",text:String(e.message||e),at:new Date().toISOString()});
 }
 finally{b.disabled=false;renderAgent();input.focus()}
}
function overviewView(){const d=ctx.data.development||{},a=analysisCache||{},rs=a.requirements||[],qs=a.questions||[],ts=a.tasks||[],facts=a.facts||[];const concept=d.concept||"Не задано пользователем.";const desc=d.description||facts.slice(0,4).map(x=>x.text||x).join("\n\n")||"Описание не сформировано из источников.";const purpose=d.goal||d.purpose||((a.analysis&&a.analysis.objective)||"Назначение не определено.");const req=d.requirements||rs.slice(0,15).map(x=>x.raw).join("\n");const func=d.functionality||rs.filter(x=>/функцион|перенос|отображ|галоч|подгруж|автоматически|карточк/i.test(x.raw)).slice(0,12).map(x=>x.raw).join("\n")||"Функциональность не определена.";const logic=d.logic||rs.slice(0,12).map(x=>(x.condition&&x.condition!=="Не определено"?x.condition+" — ":"")+x.action).join("\n")||"Логика не определена.";const values=[["Концепция","concept",concept],["Описание","description",desc],["Назначение","goal",purpose],["Требования","requirements",req||"Требования не извлечены."],["Функциональность","functionality",func],["Логика и взаимодействия","logic",logic]];return "<section><div class=\"section-head\"><h2>Обзор разработки</h2><p>Контекст разработки и аналитические выводы разделены по смыслу. Концепция — сущность задачи, описание — границы и фон, назначение — результат, требования — нормативные правила, функциональность — возможности, логика — сценарии.</p></div>"+values.map(v=>"<div class=\"card generated-field\"><div class=\"field-head\"><label>"+v[0]+"</label><span>Источник: "+(d[v[1]]?"контекст":"анализ")+"</span></div><textarea data-dev=\""+v[1]+"\">"+esc(v[2])+"</textarea></div>").join("")+"</section>"}
function sourcesView(){
 const d=ctx.data.documents;
 return "<section><div class=\"section-head\"><h2>Источники</h2><p>Все добавленные источники входят в единый контекст и автоматически учитываются общим анализом.</p></div><div class=\"card actionbar\"><button class=\"btn primary\" data-add=\"page\">+ Добавить страницу</button><button class=\"btn\" data-add=\"selection\">+ Добавить выделение</button><button class=\"btn\" data-add=\"attachments\">+ Вложения</button></div><div class=\"list\">"+(d.map(x=>"<article class=\"item\"><span class=\"source-type\">"+esc(x.type)+"</span><b>"+esc(x.title)+"</b><small>"+esc(x.sourceReference||x.url||"Локальный источник")+" · "+WC.words(x.text).length+" слов · "+esc(x.status)+"</small><div class=\"source-actions\"><button class=\"btn\" data-analyze=\""+esc(x.id)+"\">Показать в анализе</button><button class=\"btn danger\" data-remove=\""+esc(x.id)+"\">Удалить</button></div></article>").join("")||"<div class=\"empty\">Источники пока не добавлены.</div>")+"</div></section>"
}
function stat(n,label,cls=""){return "<div class=\"stat "+cls+"\"><b>"+n+"</b><small>"+label+"</small></div>"}
function analysisView(){
 const a=analysisCache||{},req=a.requirements||[],issues=a.issues||[],tasks=a.tasks||[],questions=a.questions||[],docs=ctx.data.documents;
 return "<section><div class=\"section-head\"><h2>Дашборд анализа</h2><p>Единый анализ всех источников текущей задачи разработки. Выбор базы и целевого документа не требуется.</p></div><div class=\"stats\">"+stat(docs.length,"источников")+stat(req.length,"требований")+stat(issues.length,"расхождений",issues.length?"warn":"")+stat(questions.length,"открытых вопросов")+stat(tasks.length,"кандидатов задач")+"</div><div class=\"dashboard-grid\"><div class=\"card\"><h3>Итог</h3><div class=\"prose\">"+esc((a.summary||[]).join("\n\n")||"Недостаточно данных для итогового вывода.")+"</div></div><div class=\"card\"><h3>Противоречия и расхождения</h3>"+(issues.length?issues.slice(0,8).map(findingCard).join(""):"<div class=\"empty\">Явных потенциальных противоречий между источниками не найдено.</div>")+"</div><div class=\"card\"><h3>Требования и покрытие</h3>"+(req.length?req.slice(0,15).map(reqCard).join(""):"<div class=\"empty\">Требования не извлечены.</div>")+"</div><div class=\"card\"><h3>Открытые вопросы и пробелы</h3>"+(questions.length?questions.slice(0,12).map(x=>simpleFinding("Вопрос",x.text,x.source,x.context)).join(""):"<div class=\"empty\">Открытых вопросов не найдено.</div>")+"</div><div class=\"card\"><h3>Предлагаемые рабочие задачи</h3><p class=\"muted\">Это предложения агента. Они не становятся рабочими задачами автоматически.</p>"+(tasks.length?tasks.slice(0,12).map(x=>simpleFinding("Предложение",x.text,x.source)).join(""):"<div class=\"empty\">Кандидатов в рабочие задачи не найдено.</div>")+"</div><div class=\"card\"><h3>Источники, учтённые в анализе</h3><div class=\"list compact\">"+(docs.map(x=>"<div class=\"item\"><b>"+esc(x.title)+"</b><small>"+esc(x.sourceReference||x.url||"Локальный источник")+" · "+esc(x.status)+"</small></div>").join("")||"<div class=\"empty\">Нет источников.</div>")+"</div></div></div></section>"
}
function reqCard(r){return "<article class=\"mini-card\"><div><span class=\"tag\">"+esc(r.id||r.sourceId||"REQ")+"</span><span class=\"tag\">"+esc(r.type||"requirement")+"</span></div><b>"+esc(r.raw||r.text)+"</b><small>"+esc(r.source||"Источник не определён")+" · Объект: "+esc(r.object||"не определён")+" · Действие: "+esc(r.action||"не определено")+" · Срок: "+esc(r.deadline||"не определён")+"</small><div class=\"evidence\">Доказательство: «"+esc(r.raw||r.text)+"»</div></article>"}
function findingCard(x){return "<article class=\"mini-card finding\"><b>"+esc(x.title||"Расхождение")+"</b><small>"+esc(x.a?.doc||"Источник A")+" ↔ "+esc(x.b?.doc||"Источник B")+"</small><div>"+esc(x.a?.text||x.a?.values?.join(", ")||"")+"<br>"+esc(x.b?.text||x.b?.values?.join(", ")||"")+"</div><span class=\"source\">"+esc(x.action||"Проверить актуальность источников.")+"</span></article>"}
function simpleFinding(type,text,source,context){return "<article class=\"mini-card\"><span class=\"tag\">"+type+"</span><b>"+esc(text)+"</b>"+(context?"<div class=\"evidence\">Контекст: "+esc(context)+"</div>":"")+"<small>"+esc(source||"Источник не определён")+"</small></article>"}
function organizationView(){return "<section><div class=\"section-head\"><h2>Организация</h2><p>Встречи, письма, заметки и подтверждённые рабочие задачи связаны с контекстом, но управляются отдельно от аналитики.</p></div><div class=\"card\"><h3>Встречи DION</h3><p class=\"muted\">Открывать DION не нужно. Добавьте ссылку из письма или календаря.</p><div class=\"row\"><input id=\"dionLink\" placeholder=\"https://dion.vc/event/room\"><button class=\"btn primary\" data-action=\"addMeeting\">Добавить встречу</button></div><div class=\"list compact\">"+((ctx.data.meetings||[]).map(m=>"<div class=\"item\"><b>"+esc(m.title)+"</b><small>"+esc(m.link)+"</small></div>").join("")||"<div class=\"empty\">Встреч нет.</div>")+"</div></div><div class=\"card\"><h3>Письма</h3><div class=\"list\">"+((ctx.data.emails||[]).map(m=>"<div class=\"item\"><b>"+esc(m.title)+"</b><small>"+esc(m.source)+"</small></div>").join("")||"<div class=\"empty\">Письма не добавлены.</div>")+"</div></div><div class=\"card\"><h3>Рабочие задачи</h3><p class=\"muted\">Только подтверждённые пользователем конкретные действия.</p><div class=\"list\">"+((ctx.data.workTasks||[]).map(t=>"<div class=\"item\"><b>"+esc(t.title||t.text)+"</b><small>Срок: "+esc(t.deadline||"Не определено")+" · Ответственный: "+esc(t.responsible||"Не определено")+" · "+esc(t.source||"")+"</small></div>").join("")||"<div class=\"empty\">Рабочих задач пока нет.</div>")+"</div></div><div class=\"card\"><h3>Заметки</h3><div class=\"list\">"+((ctx.data.notes||[]).map(n=>"<div class=\"item\"><b>Заметка</b><small>"+esc(n.text)+"</small></div>").join("")||"<div class=\"empty\">Заметок пока нет.</div>")+"</div></div></section>"}
function render(){const d=ctx.data.development||{};$("taskName").textContent=ctx.data.name||"Новая разработка";$("docCount").textContent=ctx.data.documents.length+" источников";$("taskCount").textContent=ctx.data.workTasks.length+" рабочих задач";$("issueCount").textContent=(analysisCache?.issues||[]).length+" проблем";document.querySelectorAll(".main-nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===currentView));$("content").innerHTML={overview:overviewView,sources:sourcesView,analysis:analysisView,organization:organizationView}[currentView]();bindDevFields();renderAgent()}
function bindDevFields(){document.querySelectorAll("[data-dev]").forEach(el=>el.onchange=async()=>{await ctx.updateDevelopment({[el.dataset.dev]:el.value});await rebuildAnalysis();render()})}
function renderAgent(){
 const el=$("agentResult");if(!el)return;
 const messages=chatMessages.filter(x=>x.role==="user"||x.role==="assistant");
 el.classList.toggle("visible",messages.length>0);
 el.innerHTML=messages.map(m=>"<div class=\"chat-message "+m.role+"\"><div class=\"chat-meta\">"+(m.role==="user"?"Вы":"AI-аналитик")+"</div><div class=\"chat-bubble\">"+esc(m.text)+"</div></div>").join("");
 if(agentResult?.state==="error"){
  const e=$("agentErrors");if(e){e.hidden=false;e.textContent=agentResult.text}
 }
 el.scrollTop=el.scrollHeight;
}
function openBrowserNoteOverlay(){const m=$("quickNoteDialog");if(!m)return;m.hidden=false;$("quickNoteText").value="";setTimeout(()=>$("quickNoteText").focus(),0)}
function closeQuickNote(){const m=$("quickNoteDialog");if(m)m.hidden=true}
async function saveQuickNote(){const text=($("quickNoteText")?.value||"").trim();if(!text)return;const note={id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),title:"Быстрая заметка",text,createdAt:new Date().toISOString(),contextName:ctx.data.development?.name||ctx.data.name||"Задача разработки"};ctx.data.notes=ctx.data.notes||[];ctx.data.notes.push(note);await ctx.save();closeQuickNote();render()}
async function addMeeting(){const u=($("dionLink")?.value||"").trim();if(!/^https:\/\/dion\.vc\/event\/[^\s]+$/i.test(u)){showError("Укажите ссылку вида https://dion.vc/event/room");return}await ingest({type:"dion",title:"Встреча DION",text:"Ссылка на встречу: "+u,sourceReference:u,url:u});currentView="organization";render()}
function handleClick(e){
 if(e.target.closest("#notesBtn")){openBrowserNoteOverlay();return}
 if(e.target.closest("#closeQuickNote")||e.target.closest("#cancelQuickNote")){closeQuickNote();return}
 if(e.target.closest("#saveQuickNote")){saveQuickNote();return}
 const v=e.target.closest("[data-view]");if(v){currentView=v.dataset.view;render();return}
 const q=e.target.closest("[data-agent-query]");if(q){$("agentInput").value=q.dataset.agentQuery;askAgent(q.dataset.agentQuery);return}
 const add=e.target.closest("[data-add]");if(add){if(add.dataset.add==="page")addPageOrSelection("page");else if(add.dataset.add==="selection")addPageOrSelection("selection");else if(add.dataset.add==="attachments")openAttachments();else if(add.dataset.add==="text")openTextImport();return}
 if(e.target.closest("#closeAttachments")){closeAttachments();return}
 if(e.target.closest("#pickFiles")){pickFiles(false);return}
 if(e.target.closest("#pickFolder")){pickFiles(true);return}
 const rm=e.target.closest("[data-remove]");if(rm){ctx.removeDocument(rm.dataset.remove).then(()=>{rebuildAnalysis();render()});return}
 const an=e.target.closest("[data-analyze]");if(an){currentView="analysis";render();return}
 const action=e.target.closest("[data-action]");if(action?.dataset.action==="addMeeting"){addMeeting();return}
}
$("filePicker")?.addEventListener("change",e=>processFiles(e.target.files));
$("folderPicker")?.addEventListener("change",e=>processFiles(e.target.files));$("closeTextImport")?.addEventListener("click",closeTextImport);$("cancelTextImport")?.addEventListener("click",closeTextImport);$("saveTextImport")?.addEventListener("click",saveTextImport);$("textImportText")?.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();saveTextImport()}});
init().catch(e=>{$("content").innerHTML="<div class=\"card\"><b>Work Copilot не запустился</b><p class=\"muted\">"+esc(e.message||e)+"</p></div>"});
