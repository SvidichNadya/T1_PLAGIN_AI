globalThis.WC=globalThis.WC||{};

/*
 * AgentRuntime is the stable orchestration boundary.
 *
 * A model provider may implement:
 *   plan({prompt,history,context,tools}) -> {tool,args}|{done:true}
 *   synthesize({prompt,history,context,results}) -> {text}
 *
 * Providers are local-only by design. The default provider is deterministic.
 * A future corporate local LLM can be plugged in without changing tools,
 * chat UI, storage or the agent loop.
 */
WC.AgentRuntime=class{
  constructor(options={}){
    this.tools=options.tools||{};
    this.planner=options.planner;
    this.synthesizer=options.synthesizer;
    this.maxSteps=options.maxSteps||5;
  }
  listTools(){return Object.entries(this.tools).map(([name,t])=>({name,description:t.description||""}))}
  async runTool(name,args,ctx){
    const tool=this.tools[name];
    if(!tool)throw Error("Неизвестный инструмент: "+name);
    return await tool.run(ctx,args||{});
  }
  async run(prompt,ctx,history){
    const steps=[],results=[];
    for(let i=0;i<this.maxSteps;i++){
      const decision=await this.planner({prompt,history,context:ctx,tools:this.listTools(),results,steps});
      if(!decision||decision.done)break;
      const name=decision.tool;
      if(!name)break;
      const started=Date.now();
      try{
        const result=await this.runTool(name,decision.args||{},ctx);
        const record={tool:name,args:decision.args||{},result,durationMs:Date.now()-started};
        results.push(record);
        steps.push({tool:name,args:decision.args||{},observation:this.observe(record)});
      }catch(e){
        const record={tool:name,args:decision.args||{},error:String(e.message||e),durationMs:Date.now()-started};
        results.push(record);
        steps.push({tool:name,args:decision.args||{},observation:"ошибка: "+record.error});
        break;
      }
    }
    const final=await this.synthesizer({prompt,history,context:ctx,results,steps,tools:this.listTools()});
    return {text:String(final?.text||""),results,steps};
  }
  observe(r){
    if(r.error)return"ошибка инструмента";
    const x=r.result||{};
    if(r.tool==="search_sources")return"найдено "+((x.items||[]).length)+" релевантных источников";
    if(r.tool==="inspect_source")return x.found?"изучен источник «"+x.source.title+"»":"источник не найден";
    if(r.tool==="get_context_summary")return"получена сводка";
    return"получено "+((x.items||[]).length)+" элементов";
  }
};

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
    inspect_source:{description:"Возвращает текст конкретного или наиболее релевантного источника.",run(ctx,a){let d=a.id?ctx.documents.find(x=>x.id===a.id):null;if(!d&&a.title){const n=WC.ai._norm(a.title);d=ctx.documents.find(x=>WC.ai._norm(x.title).includes(n)||n.includes(WC.ai._norm(x.title)))}if(!d&&a.query)d=WC.analyze.retrieve(ctx,a.query,1)[0];if(!d)return{found:false};const t=String(d.text||"");return{found:true,source:{id:d.id,title:d.title,type:d.type,url:d.url||d.sourceReference||"",text:t.slice(0,20000),wordCount:WC.words(t).length}}}}
  },
  _norm(s){return String(s||"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim()},
  _has(results,name){return results.some(x=>x.tool===name)},
  deterministicPlanner({prompt,results}){
    const p=this.normalize(prompt),last=results[results.length-1],has=n=>this._has(results,n);
    const add=(tool,args={})=>({tool,args});
    if(!last){
      if(/\b(противореч|конфликт|расхожд|несоглас)/.test(p))return add("find_conflicts");
      if(/\b(требован|должен|должна|нужно реализ|что требуется)/.test(p))return add("get_requirements");
      if(/\b(задач|сделать|что дальше|следующ|доработ|реализова)/.test(p))return add("get_tasks");
      if(/\b(решен|решили|согласован|приняли решение)/.test(p))return add("get_decisions");
      if(/\b(итог|суммар|резюме|что известно|суть|контекст)/.test(p))return add("get_context_summary");
      return add("search_sources",{query:prompt});
    }
    if(last.error)return{done:true};
    if(last.tool==="search_sources"){
      const items=last.result?.items||[];
      if(items.length===1&&!has("inspect_source"))return add("inspect_source",{id:items[0].id});
      if(/\b(требован|должен|нужно)/.test(p)&&!has("get_requirements"))return add("get_requirements");
      if(/\b(противореч|конфликт|расхожд)/.test(p)&&!has("find_conflicts"))return add("find_conflicts");
      if(/\b(решен|согласован)/.test(p)&&!has("get_decisions"))return add("get_decisions");
      return{done:true};
    }
    if(last.tool==="inspect_source"){
      if(/\b(требован|должен|нужно)/.test(p)&&!has("get_requirements"))return add("get_requirements");
      if(/\b(противореч|конфликт|расхожд)/.test(p)&&!has("find_conflicts"))return add("find_conflicts");
      return{done:true};
    }
    if(["get_requirements","find_conflicts","get_tasks","get_decisions"].includes(last.tool)&&!has("search_sources"))return add("search_sources",{query:prompt});
    return{done:true};
  },
  deterministicSynthesize({results}){
    const parts=[];
    for(const r of results){
      if(r.error)continue;const d=r.result||{};
      if(r.tool==="get_context_summary"&&(d.summary||[]).length)parts.push(d.summary.map(x=>"• "+x).join("\n"));
      else if(r.tool==="search_sources"&&(d.items||[]).length)parts.push(d.items.map(x=>"**"+x.title+"**\n"+x.evidence.map(e=>"• "+e).join("\n")).join("\n\n"));
      else if(r.tool==="inspect_source"&&d.found)parts.push("**"+d.source.title+"**\n"+d.source.text);
      else if((d.items||[]).length)parts.push(d.items.slice(0,30).map(x=>"• "+(x.text||x.raw||JSON.stringify(x))).join("\n"));
    }
    return{ text:parts.filter(Boolean).join("\n\n")||"Я не нашёл достаточных данных в текущем контексте, чтобы ответить на вопрос. Уточни объект или добавь источник."};
  },
  createRuntime(){
    return new WC.AgentRuntime({
      tools:this.tools,
      planner:args=>this.deterministicPlanner(args),
      synthesizer:args=>this.deterministicSynthesize(args),
      maxSteps:this.maxToolSteps
    });
  },
  /*
   * Extension point for the future corporate local LLM.
   * The provider must be local and may be registered later:
   * WC.ai.setModelProvider({plan:async(...),synthesize:async(...)})
   */
  setModelProvider(provider){
    if(!provider||typeof provider.plan!=="function"||typeof provider.synthesize!=="function")throw Error("Некорректный local model provider.");
    this.modelProvider=provider;
  },
  createRuntimeWithProvider(provider){
    const p=provider||this.modelProvider;
    if(!p)return this.createRuntime();
    return new WC.AgentRuntime({
      tools:this.tools,
      planner:args=>p.plan({...args,toolDefinitions:this.tools}),
      synthesizer:args=>p.synthesize({...args,toolDefinitions:this.tools}),
      maxSteps:this.maxToolSteps
    });
  },
  async ask(prompt,ctx){
    const q=String(prompt||"").trim();if(!q)throw Error("Введите вопрос.");
    const history=await this.loadHistory();
    if(/^(привет|здравств|добрый|хай|hello|hi)\b/i.test(this.normalize(q))){
      const text="Привет. Я локальный аналитический агент Work Copilot. Я сам выбираю инструменты для работы с источниками и аналитикой текущей разработки. Сейчас в контексте "+ctx.documents.length+" источников.";
      const next=history.concat([{role:"user",text:q,at:new Date().toISOString()},{role:"assistant",text,at:new Date().toISOString(),tools:[]}]).slice(-this.maxHistory);await this.saveHistory(next);return{mode:"local-agent",text,history:next,steps:[]};
    }
    const runtime=this.createRuntimeWithProvider(this.modelProvider);
    const run=await runtime.run(q,ctx,history);
    const next=history.concat([{role:"user",text:q,at:new Date().toISOString()},{role:"assistant",text:run.text,at:new Date().toISOString(),tools:run.steps.map(x=>x.tool),steps:run.steps}]).slice(-this.maxHistory);
    await this.saveHistory(next);
    return{mode:this.modelProvider?"local-llm-agent":"local-agent",text:run.text,history:next,steps:run.steps,toolResults:run.results};
  },
  async clearHistory(){try{await WC.api.storage.session.remove(this.key)}catch(_){}}
};