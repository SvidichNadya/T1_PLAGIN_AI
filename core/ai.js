globalThis.WC=globalThis.WC||{};
WC.ai={
  available:false,
  key:"wc-chat",
  maxHistory:40,
  async loadHistory(){
    try{
      const x=await WC.api.storage.session.get(this.key);
      return Array.isArray(x[this.key])?x[this.key]:[];
    }catch(_){return[]}
  },
  async saveHistory(history){
    try{await WC.api.storage.session.set({[this.key]:history.slice(-this.maxHistory)})}catch(_){}
  },
  normalize(s){
    return String(s||"").toLowerCase().replace(/ё/g,"е").replace(/[^а-яa-z0-9\s?]/g," ").replace(/\s+/g," ").trim();
  },
  intent(prompt){
    const p=this.normalize(prompt);
    if(/^(привет|здравствуй|добрый (день|вечер|утро)|хай|hello|hi)\b/.test(p))return"greeting";
    if(/^(спасибо|благодарю|понятно|ок|хорошо)\b/.test(p))return"thanks";
    if(/\b(противореч|конфликт|расхожд|несоглас)/.test(p))return"issues";
    if(/\b(пропущ|пробел|не хватает|не покрыт|покрыти)/.test(p))return"gaps";
    if(/\b(требован|требуется|нужно|должен|должна)/.test(p))return"requirements";
    if(/\b(задач|сделать|сделат|что дальше|следующ|остал)/.test(p))return"tasks";
    if(/\b(вопрос|уточн|неясн)/.test(p))return"questions";
    if(/\b(решен|решили|согласован)/.test(p))return"decisions";
    if(/\b(источник|документ|документа|материал)/.test(p))return"sources";
    if(/\b(суммар|итог|кратко|резюме|контекст)/.test(p))return"summary";
    return"search";
  },
  contextText(ctx){
    return ctx.documents.map(d=>d.title+"\n"+String(d.text||"")).join("\n\n");
  },
  evidence(ctx,query){
    const docs=WC.analyze.retrieve(ctx,query,6);
    return docs.map(d=>{
      const ev=WC.analyze.evidence(d.text,query).slice(0,3);
      return {title:d.title,id:d.id,items:ev};
    }).filter(x=>x.items.length);
  },
  answer(intent,prompt,ctx,a,history){
    if(intent==="greeting")return "Привет. Я локальный аналитический агент Work Copilot.\n\nЯ могу работать с текущей задачей разработки и продолжать диалог: находить требования, противоречия, пробелы, вопросы, решения и предлагаемые рабочие задачи, а также отвечать на вопросы по содержимому источников.\n\nСейчас в контексте: "+ctx.documents.length+" источников.";
    if(intent==="thanks")return "Пожалуйста. Можешь продолжить с уточняющим вопросом — я сохраню историю текущего диалога.";
    if(!ctx.documents.length)return "В текущем контексте пока нет источников с текстом. Добавь страницу, выделение или локальный файл — после этого я смогу отвечать по материалам.";
    if(intent==="summary")return a.summary.length?a.summary.map(x=>"• "+x).join("\n"):"В источниках недостаточно текста для сводки.";
    if(intent==="issues")return a.issues.length?a.issues.map((x,i)=>"**"+(i+1)+". "+x.title+"**\n"+x.a.doc+": "+(x.a.text||x.a.values?.join(", ")||"")+"\n"+x.b.doc+": "+(x.b.text||x.b.values?.join(", ")||"")+"\nДействие: "+x.action).join("\n\n"):"Явных потенциальных противоречий по текущим правилам анализа не найдено.";
    if(intent==="requirements")return a.requirements.length?a.requirements.slice(0,30).map(r=>"• "+r.text+" — "+r.source).join("\n"):"Явных требований в источниках не найдено.";
    if(intent==="gaps")return a.changes?.missing?.length?"Обнаружены непокрытые элементы при сравнении доступных источников:\n"+a.changes.missing.slice(0,30).map(x=>"• "+(x.raw||x.text||x)).join("\n"):"По доступным данным явных непокрытых элементов не найдено. Это не означает, что пробелов точно нет.";
    if(intent==="tasks")return a.tasks.length?a.tasks.map(x=>"• "+x.text+" — "+x.source+"\n  Статус: предложение, не подтверждённая рабочая задача.").join("\n"):"Предлагаемых рабочих задач в источниках не найдено.";
    if(intent==="questions")return a.questions.length?a.questions.map(x=>"• "+x.text+" — "+x.source).join("\n"):"Открытых вопросов в источниках не найдено.";
    if(intent==="decisions")return a.decisions.length?a.decisions.map(x=>"• "+x.text+" — "+x.source).join("\n"):"Явно зафиксированных решений в источниках не найдено.";
    if(intent==="sources")return ctx.documents.map((d,i)=>(i+1)+". "+d.title+" · "+d.type+" · "+WC.words(d.text).length+" слов").join("\n");
    const ev=this.evidence(ctx,prompt);
    if(ev.length)return "Нашёл релевантные фрагменты в источниках:\n\n"+ev.map(x=>"**"+x.title+"**\n"+x.items.map(y=>"• "+y).join("\n")).join("\n\n");
    if(history.length>1){
      const last=history.slice(-4).filter(x=>x.role==="user").map(x=>x.text).join(" ");
      const ev2=this.evidence(ctx,last+" "+prompt);
      if(ev2.length)return "По текущему вопросу прямого совпадения не нашёл, но с учётом предыдущего диалога релевантны:\n\n"+ev2.map(x=>"**"+x.title+"**\n"+x.items.map(y=>"• "+y).join("\n")).join("\n\n");
    }
    return "Я не нашёл в текущих источниках достаточных данных, чтобы ответить на этот вопрос. Уточни объект или добавь источник. Я не буду придумывать сведения, которых нет в контексте.";
  },
  async ask(prompt,ctx){
    const q=String(prompt||"").trim();
    if(!q)throw Error("Введите вопрос.");
    const history=await this.loadHistory();
    const intent=this.intent(q),a=WC.analyze.context(ctx);
    const text=this.answer(intent,q,ctx,a,history);
    const next=history.concat([{role:"user",text:q,at:new Date().toISOString()},{role:"assistant",text,at:new Date().toISOString(),intent}]).slice(-this.maxHistory);
    await this.saveHistory(next);
    return{mode:"local-agent",title:"Локальный аналитический агент",text,data:a,history:next,intent};
  },
  async clearHistory(){try{await WC.api.storage.session.remove(this.key)}catch(_){}}
};