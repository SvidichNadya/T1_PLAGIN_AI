window.WC=window.WC||{};
WC.ai={available:false,async ask(prompt,ctx){const p=String(prompt||"").toLowerCase();const a=WC.analyze.context(ctx);let title="Детерминированный локальный анализ";let text="";
if(/противореч|конфликт|несоглас/.test(p))text=a.issues.length?a.issues.map((x,i)=>"Конфликт "+(i+1)+": "+x.title+"\n"+x.a.doc+": "+(x.a.text||x.a.values?.join(", ")||"")+"\n"+x.b.doc+": "+(x.b.text||x.b.values?.join(", ")||"")+"\nДействие: "+x.action).join("\n\n"):"Явных потенциальных противоречий не найдено.";
else if(/требован|атомар/.test(p))text=a.atomicRequirements.length?a.atomicRequirements.slice(0,30).map(r=>r.id+" — "+r.raw+" ["+r.source+"]").join("\n"):"Требования не найдены.";
else if(/пропущ|покры/.test(p)&&ctx.documents.length>=2){const r=WC.requirements.coverage(ctx.documents[0],ctx.documents[1]);text="Покрыто: "+r.covered.length+"\nПропущено: "+r.missing.length+"\nНовых в целевом: "+r.newInTarget.length;}
else if(/задач|сделат|остал/.test(p))text=a.tasks.length?a.tasks.map(x=>"• "+x.text+" — "+x.source).join("\n"):"Рабочих задач из источников не найдено.";
else if(/вопрос/.test(p))text=a.questions.length?a.questions.map(x=>"• "+x.text+" — "+x.source).join("\n"):"Открытых вопросов не найдено.";
else if(/решен/.test(p))text=a.decisions.length?a.decisions.map(x=>"• "+x.text+" — "+x.source).join("\n"):"Решений не найдено.";
else text=a.summary.length?a.summary.map(x=>"• "+x).join("\n"):"В контексте нет текста для анализа.";
return{mode:"deterministic",title,text,data:a}}};