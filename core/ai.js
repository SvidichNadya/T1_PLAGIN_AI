globalThis.WC=globalThis.WC||{};
WC.ai={
  key:"wc-chat",maxHistory:40,maxToolSteps:5,
  async loadHistory(){try{const x=await WC.api.storage.session.get(this.key);return Array.isArray(x[this.key])?x[this.key]:[]}catch(_){return[]}},
  async saveHistory(h){try{await WC.api.storage.session.set({[this.key]:h.slice(-this.maxHistory)})}catch(_){}},
  normalize(s){return String(s||"").toLowerCase().replace(/ё/g,"е").replace(/[^а-яa-z0-9\s?]/g," ").replace(/\s+/g," ").trim()},
  tools:{
    search_sources:{description:"Ищет релевантные фрагменты по всем источникам.",run(ctx,a){const q=String(a.query||"").trim();if(!q)return{items:[]};return{items:WC.analyze.retrieve(ctx,q,8).map(d=>({id:d.id,title:d.title,type:d.type,evidence:WC.analyze.evidence(d.text,q).slice(0,5)})).filter(x=>x.evidence.length)}}},
    get_requirements:{description:"Возвращает извлечённые требования.",run(ctx){return{items:(WC.analyze.context(ctx).requirements||[]).slice(0,50)}}},
    find_conflicts:{description:"Находит потенциальные противоречия.",run(ctx){return{items:(WC.analyze.context(ctx).issues||[]).slice(0,30)}}},
    get_tasks:{description:"Возвращает предложения рабочих задач.",run(ctx){return{items:(WC.analyze.context(ctx).tasks||[]).slice(0,30)}}},
    get_decisions:{description:"Возвращает явно зафиксированные решения.",run(ctx){return{items:(WC.analyze.context(ctx).decisions||[]).slice(0,30)}}},
    get_context_summary:{description:"Строит сводку текущей разработки.",run(ctx){const a=WC.analyze.context(ctx);return{summary:a.summary||[],counts:{sources:ctx.documents.length,requirements:(a.requirements||[]).length,issues:(a.issues||[]).length,tasks:(a.tasks||[]).length,questions:(a.questions||[]).length,decisions:(a.decisions||[]).length}}}},
    inspect_source:{description:"Возвращает текст конкретного или наиболее релевантного источника.",run(ctx,a){let d=a.id?ctx.documents.find(x=>x.id===a.id):null;if(!d&&a.title){const n=this._norm(a.title);d=ctx.documents.find(x=>this._norm(x.title).includes(n)||n.includes(this._norm(x.title)))}if(!d&&a.query)d=WC.analyze.retrieve(ctx,a.query,1)[0];if(!d)return{found:false};const t=String(d.text||"");return{found:true,source:{id:d.id,title:d.title,type:d.type,url:d.url||d.sourceReference||"",text:t.slice(0,20000),wordCount:WC.words(t).length}}}}
  },
  _norm(s){return String(s||"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim()},
  _toolSummary(r){if(r.error)return"ошибка инструмента";const x=r.result||{};if(r.tool==="search_sources")return"x="+(x.items||[]).length+" релевантных источников";if(r.tool==="inspect_source")return x.found?"найден источник "+x.source.title:"источник не найден";if(r.tool==="get_context_summary")return"x="+((x.summary||[]).length)+" пунктов сводки";return"x="+((x.items||[]).length)+" элементов"},
  planInitial(q){
    const p=this.normalize(q),plan=[];
    const add=(name,args={})=>plan.push({name,args});
    if(/\b(противореч|конфликт|расхожд|несоглас)/.test(p))add("find_conflicts");
    else if(/\b(требован|должен|должна|нужно реализ|что требуется)/.test(p))add("get_requirements");
    else if(/\b(задач|сделать|что дальше|следующ|доработ|реализова)/.test(p))add("get_tasks");
    else if(/\b(решен|решили|согласован|приняли решение)/.test(p))add("get_decisions");
    else if(/\b(итог|суммар|резюме|что известно|суть|контекст)/.test(p))add("get_context_summary");
    else add("search_sources",{query:q});
    return plan;
  },
  nextStep(q,history,results){
    const p=this.normalize(q),last=results[results.length-1],has=(name)=>results.some(x=>x.tool===name),add=(name,args={})=>({name,args});
    if(!last||last.error)return null;
    if(last.tool==="search_sources"){
      const items=last.result?.items||[];
      if(!items.length)return null;
      if(items.length===1&&!has("inspect_source"))return add("inspect_source",{id:items[0].id});
      if(/\b(требован|должен|нужно)/.test(p)&&!has("get_requirements"))return add("get_requirements");
      if(/\b(противореч|конфликт|расхожд)/.test(p)&&!has("find_conflicts"))return add("find_conflicts");
      if(/\b(решен|согласован)/.test(p)&&!has("get_decisions"))return add("get_decisions");
      return null;
    }
    if(last.tool==="inspect_source"){
      if(/\b(требован|должен|нужно)/.test(p)&&!has("get_requirements"))return add("get_requirements");
      if(/\b(противореч|конфликт|расхожд)/.test(p)&&!has("find_conflicts"))return add("find_conflicts");
      return null;
    }
    if(last.tool==="get_requirements"&&!has("search_sources"))return add("search_sources",{query:q});
    if(last.tool==="find_conflicts"&&!has("search_sources"))return add("search_sources",{query:q});
    if(last.tool==="get_tasks"&&!has("search_sources"))return add("search_sources",{query:q});
    return null;
  },
  async runTool(name,args,ctx){const t=this.tools[name];if(!t)throw Error("Неизвестный инструмент: "+name);return await t.run(ctx,args||{})},
  async runAgent(q,ctx,history){
    const steps=[],results=[];
    let next=this.planInitial(q);
    for(let i=0;i<this.maxToolSteps&&next;i++){
      const started=Date.now();
      try{
        const result=await this.runTool(next.name,next.args,ctx);
        const record={tool:next.name,args:next.args||{},result,durationMs:Date.now()-started};
        results.push(record);steps.push({tool:next.name,args:next.args||{},observation:this._toolSummary(record)});
        next=this.nextStep(q,history,results);
      }catch(e){
        const record={tool:next.name,args:next.args||{},error:String(e.message||e),durationMs:Date.now()-started};
        results.push(record);steps.push({tool:next.name,args:next.args||{},observation:"ошибка"});
        break;
      }
    }
    return{results,steps};
  },
  formatItem(x){if(x==null)return"";if(typeof x==="string")return x;if(x.text)return x.text+(x.source?" — "+x.source:"");if(x.raw)return x.raw+(x.source?" — "+x.source:"");return JSON.stringify(x)},
  synthesize(q,results){
    const parts=[];
    for(const r of results){
      if(r.error)continue;const d=r.result||{};
      if(r.tool==="get_context_summary"&&(d.summary||[]).length)parts.push(d.summary.map(x=>"• "+x).join("\n"));
      else if(r.tool==="search_sources"&&(d.items||[]).length)parts.push(d.items.map(x=>"**"+x.title+"**\n"+x.evidence.map(e=>"• "+e).join("\n")).join("\n\n"));
      else if(r.tool==="inspect_source"&&d.found)parts.push("**"+d.source.title+"**\n"+d.source.text);
      else if((d.items||[]).length)parts.push(d.items.slice(0,30).map(x=>"• "+this.formatItem(x)).join("\n"));
    }
    return parts.filter(Boolean).join("\n\n")||"Я не нашёл достаточных данных в текущем контексте, чтобы ответить на вопрос. Уточни объект или добавь источник.";
  },
  async ask(prompt,ctx){
    const q=String(prompt||"").trim();if(!q)throw Error("Введите вопрос.");
    const history=await this.loadHistory();
    if(/^(привет|здравств|добрый|хай|hello|hi)\b/i.test(this.normalize(q))){
      const text="Привет. Я локальный аналитический агент Work Copilot. Я сам выбираю локальные инструменты для работы с источниками и аналитикой текущей разработки. Сейчас в контексте "+ctx.documents.length+" источников.";
      const next=history.concat([{role:"user",text:q,at:new Date().toISOString()},{role:"assistant",text,at:new Date().toISOString(),tools:[]}]).slice(-this.maxHistory);await this.saveHistory(next);return{mode:"local-agent",text,history:next,steps:[]};
    }
    const run=await this.runAgent(q,ctx,history),text=this.synthesize(q,run.results);
    const next=history.concat([{role:"user",text:q,at:new Date().toISOString()},{role:"assistant",text,at:new Date().toISOString(),tools:run.steps.map(x=>x.tool),steps:run.steps}]).slice(-this.maxHistory);
    await this.saveHistory(next);
    return{mode:"local-agent",text,history:next,steps:run.steps,toolResults:run.results};
  },
  async clearHistory(){try{await WC.api.storage.session.remove(this.key)}catch(_){}}
};