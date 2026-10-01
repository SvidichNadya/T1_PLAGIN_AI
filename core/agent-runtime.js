globalThis.WC=globalThis.WC||{};
WC.AgentRuntime=class{
 constructor(options={}){this.tools=options.tools||{};this.planner=options.planner;this.synthesizer=options.synthesizer;this.maxSteps=options.maxSteps||5}
 listTools(){return Object.entries(this.tools).map(([name,t])=>({name,description:t.description||""}))}
 async runTool(name,args,ctx){const t=this.tools[name];if(!t)throw Error("Неизвестный инструмент: "+name);return t.run(ctx,args||{})}
 async run(prompt,ctx,history){
  const steps=[],results=[];
  for(let i=0;i<this.maxSteps;i++){
   let decision;
   try{decision=await this.planner({prompt,history,context:ctx,tools:this.listTools(),results,steps})}
   catch(e){return this.fallback(prompt,ctx,history,results,steps,"Ошибка planner: "+String(e.message||e))}
   if(!decision||decision.done)break;
   try{const started=Date.now(),result=await this.runTool(decision.tool,decision.args,ctx),record={tool:decision.tool,args:decision.args||{},result,durationMs:Date.now()-started};results.push(record);steps.push({tool:decision.tool,args:decision.args||{},observation:this.observe(record)})}
   catch(e){steps.push({tool:decision.tool,args:decision.args||{},observation:"ошибка: "+String(e.message||e)});break}
  }
  try{const final=await this.synthesizer({prompt,history,context:ctx,results,steps,tools:this.listTools()});return{text:String(final?.text||""),results,steps,provider:"configured"}}
  catch(e){return this.fallback(prompt,ctx,history,results,steps,"Ошибка synthesizer: "+String(e.message||e))}
 }
 async fallback(prompt,ctx,history,results,steps,reason){
  const p=WC.LLM.createDeterministicProvider(WC.ai);
  const runtime=new WC.AgentRuntime({tools:this.tools,planner:a=>p.plan(a),synthesizer:a=>p.synthesize(a),maxSteps:this.maxSteps});
  const r=await runtime.run(prompt,ctx,history);
  return{text:r.text,results:r.results,steps:[{tool:"fallback",observation:"Использован deterministic provider: "+reason},...r.steps],provider:"deterministic-fallback"};
 }
 observe(r){if(r.error)return"ошибка инструмента";const x=r.result||{};if(r.tool==="search_sources")return"найдено "+((x.items||[]).length)+" релевантных источников";if(r.tool==="inspect_source")return x.found?"изучен источник «"+x.source.title+"»":"источник не найден";if(r.tool==="get_context_summary")return"получена сводка";return"получено "+((x.items||[]).length)+" элементов"}
};