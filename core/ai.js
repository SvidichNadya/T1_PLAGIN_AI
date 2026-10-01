globalThis.WC=globalThis.WC||{};
WC.ai={
  key:"wc-chat",
  maxHistory:40,
  maxToolSteps:4,
  async loadHistory(){
    try{const x=await WC.api.storage.session.get(this.key);return Array.isArray(x[this.key])?x[this.key]:[]}catch(_){return[]}
  },
  async saveHistory(history){
    try{await WC.api.storage.session.set({[this.key]:history.slice(-this.maxHistory)})}catch(_){}
  },
  normalize(s){
    return String(s||"").toLowerCase().replace(/ё/g,"е").replace(/[^а-яa-z0-9\s?]/g," ").replace(/\s+/g," ").trim();
  },
  tools:{
    search_sources:{description:"Ищет релевантные фрагменты по всем источникам.",run(ctx,args){
      const q=String(args.query||"").trim();if(!q)return{items:[]};
      const docs=WC.analyze.retrieve(ctx,q,8);
      return{items:docs.map(d=>({id:d.id,title:d.title,type:d.type,evidence:WC.analyze.evidence(d.text,q).slice(0,5)})).filter(x=>x.evidence.length)};
    }},
    get_requirements:{description:"Возвращает извлечённые требования.",run(ctx){
      const a=WC.analyze.context(ctx);return{items:(a.requirements||[]).slice(0,50)};
    }},
    find_conflicts:{description:"Находит потенциальные противоречия и расхождения.",run(ctx){
      const a=WC.analyze.context(ctx);return{items:(a.issues||[]).slice(0,30)};
    }},
    get_tasks:{description:"Возвращает предложения рабочих задач; они не подтверждены автоматически.",run(ctx){
      const a=WC.analyze.context(ctx);return{items:(a.tasks||[]).slice(0,30)};
    }},
    get_decisions:{description:"Возвращает явно зафиксированные решения.",run(ctx){
      const a=WC.analyze.context(ctx);return{items:(a.decisions||[]).slice(0,30)};
    }},
    get_context_summary:{description:"Строит сводку всей текущей разработки.",run(ctx){
      const a=WC.analyze.context(ctx);return{summary:a.summary||[],counts:{sources:ctx.documents.length,requirements:(a.requirements||[]).length,issues:(a.issues||[]).length,tasks:(a.tasks||[]).length,questions:(a.questions||[]).length,decisions:(a.decisions||[]).length}};
    }},
    inspect_source:{description:"Возвращает содержимое конкретного источника или наиболее близкого источника.",run(ctx,args){
      let d=args.id?ctx.documents.find(x=>x.id===args.id):null;
      if(!d&&args.title){const n=this._norm(args.title);d=ctx.documents.find(x=>this._norm(x.title).includes(n)||n.includes(this._norm(x.title)))}
      if(!d&&args.query){const found=WC.analyze.retrieve(ctx,args.query,1);d=found[0]}
      if(!d)return{found:false};
      const text=String(d.text||"");return{found:true,source:{id:d.id,title:d.title,type:d.type,url:d.url||d.sourceReference||"",text:text.slice(0,20000),wordCount:WC.words(text).length}};
    }}
  },
  _norm(s){return String(s||"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim()},
  chooseTools(prompt,ctx,history){
    const p=this.normalize(prompt),chosen=[];
    const add=(name,args={})=>{if(!chosen.some(x=>x.name===name))chosen.push({name,args})};
    if(/\b(привет|здравств|добрый|хай|hello|hi|спасибо|благодар)/.test(p))return[];
    if(/\b(противореч|конфликт|расхожд|несоглас|разные версии)/.test(p))add("find_conflicts");
    if(/\b(требован|должен|должна|нужно реализ|что требуется)/.test(p))add("get_requirements");
    if(/\b(задач|сделать|что дальше|следующ|доработ|реализова)/.test(p))add("get_tasks");
    if(/\b(решен|решили|согласован|приняли решение)/.test(p))add("get_decisions");
    if(/\b(итог|суммар|резюме|что известно|суть|контекст)/.test(p))add("get_context_summary");
    if(/\b(источник|документ|где написано|в каком документе|цитат|текст)/.test(p))add("search_sources",{query:prompt});
    if(!chosen.length)add("search_sources",{query:prompt});
    if(chosen.length===1&&chosen[0].name!=="search_sources"&&!/\b(все|полный|полностью|подроб)/.test(p))add("search_sources",{query:prompt});
    if(history.length){
      const previous=history.slice(-6).filter(x=>x.role==="user").map(x=>x.text).join(" ");
      if(/\b(это|этот|эта|здесь|там|он|она|они|такой|такие|а почему|а как|а что)/.test(p)&&previous)add("search_sources",{query:previous+" "+prompt});
    }
    return chosen.slice(0,this.maxToolSteps);
  },
  async runTools(plan,ctx){
    const results=[];
    for(const step of plan){
      const tool=this.tools[step.name];
      if(!tool)continue;
      try{results.push({tool:step.name,args:step.args||{},result:tool.run(ctx,step.args||{})})}
      catch(e){results.push({tool:step.name,error:String(e.message||e)})}
    }
    return results;
  },
  formatItem(x){
    if(x==null)return "";
    if(typeof x==="string")return x;
    if(x.text)return x.text+(x.source?" — "+x.source:"");
    if(x.raw)return x.raw+(x.source?" — "+x.source:"");
    return JSON.stringify(x);
  },
  synthesize(prompt,plan,results,ctx){
    const meaningful=results.filter(x=>x.result&&(!x.result.items||x.result.items.length||x.result.summary?.length));
    if(!meaningful.length)return "Я не нашёл достаточных данных в текущем контексте, чтобы ответить на вопрос. Уточни объект или добавь источник.";
    const sections=[];
    for(const r of meaningful){
      const d=r.result;
      if(r.tool==="get_context_summary")sections.push(d.summary?.length?d.summary.map(x=>"• "+x).join("\n"):"В сводке недостаточно данных.");
      else if(r.tool==="search_sources")sections.push(d.items.map(x=>"**"+x.title+"**\n"+x.evidence.map(e=>"• "+e).join("\n")).join("\n\n"));
      else if(r.tool==="inspect_source")sections.push(d.found?"**"+d.source.title+"**\n"+d.source.text:"Источник не найден.");
      else sections.push((d.items||[]).slice(0,30).map(x=>"• "+this.formatItem(x)).join("\n")||"Ничего не найдено.");
    }
    const label=plan.map(x=>x.name).join(", ");
    return sections.filter(Boolean).join("\n\n")||"Ничего не найдено.";
  },
  async ask(prompt,ctx){
    const q=String(prompt||"").trim();if(!q)throw Error("Введите вопрос.");
    const history=await this.loadHistory();
    if(/^(привет|здравств|добрый|хай|hello|hi)\b/i.test(this.normalize(q))){
      const text="Привет. Я локальный аналитический агент Work Copilot. Я могу самостоятельно выбирать инструменты для поиска по источникам, требований, противоречий, задач, решений и сводки текущей разработки. Сейчас в контексте "+ctx.documents.length+" источников.";
      const next=history.concat([{role:"user",text:q,at:new Date().toISOString()},{role:"assistant",text,at:new Date().toISOString(),tools:[]}]).slice(-this.maxHistory);await this.saveHistory(next);return{mode:"local-agent",text,history:next,tools:[]};
    }
    const plan=this.chooseTools(q,ctx,history);
    const results=await this.runTools(plan,ctx);
    const text=this.synthesize(q,plan,results,ctx);
    const next=history.concat([{role:"user",text:q,at:new Date().toISOString()},{role:"assistant",text,at:new Date().toISOString(),tools:plan.map(x=>x.name)}]).slice(-this.maxHistory);
    await this.saveHistory(next);
    return{mode:"local-agent",text,history:next,tools:plan,toolResults:results};
  },
  async clearHistory(){try{await WC.api.storage.session.remove(this.key)}catch(_){}}
};