window.WC = window.WC || {};
WC.analyze = {
  summarize(text,max=8){
    const s=WC.sentences(text).filter(Boolean);
    if(s.length<=max)return s;
    return s.map((x,i)=>({x,i,score:Math.min(WC.words(x).length,50)+(WC.extract.dates(x).length*5)+(WC.extract.tasks(x).length*4)+(WC.extract.requirements(x).length*4)}))
      .sort((a,b)=>b.score-a.score).slice(0,max).sort((a,b)=>a.i-b.i).map(x=>x.x);
  },
  facts(text){
    return WC.sentences(text).filter(s=>s.length>25&&!/[?]$/.test(s)&&!/(нужно|необходимо|требуется|решили|согласовано)\\b/i.test(s)).slice(0,80);
  },
  document(d){
    const text=WC.clean(d.text);
    return {id:d.id,title:d.title,type:d.type,summary:this.summarize(text,8),detailedSummary:this.summarize(text,15),
      facts:this.facts(text),requirements:WC.extract.requirements(text),decisions:WC.extract.decisions(text),
      questions:WC.extract.questions(text),tasks:WC.extract.tasks(text),dates:WC.extract.dates(text),times:WC.extract.times(text),
      participants:WC.extract.participants(text),links:WC.extract.links(text),terminology:WC.extract.keyTerms(text),wordCount:WC.words(text).length};
  },
  compare(a,b){
    const A=WC.clean(a).split(/\\n+/).map(x=>x.trim()).filter(Boolean),B=WC.clean(b).split(/\\n+/).map(x=>x.trim()).filter(Boolean);
    const norm=x=>x.toLowerCase().replace(/\\s+/g," "),sa=new Set(A.map(norm)),sb=new Set(B.map(norm));
    return {onlyA:A.filter(x=>!sb.has(norm(x))),onlyB:B.filter(x=>!sa.has(norm(x)))};
  },
  contradictionPairs(docs){
    const out=[];
    if(docs.length<2)return out;
    const per=docs.map(d=>({d,dates:WC.extract.dates(d.text),req:WC.extract.requirements(d.text)}));
    for(let i=0;i<per.length;i++)for(let j=i+1;j<per.length;j++){
      const a=per[i],b=per[j];
      if(a.dates.length&&b.dates.length&&!a.dates.some(x=>b.dates.includes(x))){
        out.push({kind:"date",title:"Разные даты/сроки",a:{doc:a.d.title,values:a.dates},b:{doc:b.d.title,values:b.dates},action:"Уточнить актуальную дату по ответственному источнику.",confidence:"medium"});
      }
      const neg=s=>/(не\\s+(должен|требуется|нужно)|запрещено|нельзя)/i.test(s);
      for(const x of a.req.slice(0,25))for(const y of b.req.slice(0,25)){
        if(neg(x)!==neg(y)&&this.topicOverlap(x,y)){
          out.push({kind:"requirement",title:"Возможное противоречие требований",a:{doc:a.d.title,text:x},b:{doc:b.d.title,text:y},action:"Проверить область действия и актуальность обоих требований.",confidence:"medium"});
        }
      }
    }
    return out.slice(0,100);
  },
  topicOverlap(a,b){
    const wa=new Set((a.toLowerCase().match(/[а-яёa-z]{5,}/g)||[]));
    const wb=(b.toLowerCase().match(/[а-яёa-z]{5,}/g)||[]);
    let n=0;for(const w of wb)if(wa.has(w))n++;
    return n>=2;
  },
  requirements(ctx){const docs=ctx.documents.map(d=>({id:d.id,title:d.title,text:d.text}));return WC.requirements?WC.requirements.trace(docs):{requirements:[],links:[]};},
  changes(ctx,baseIndex=0,targetIndex=1){if(ctx.documents.length<2)return {base:null,target:null,covered:[],missing:[],newInTarget:[]};return WC.requirements.coverage(ctx.documents[baseIndex],ctx.documents[targetIndex]);},
  evidence(text,term){const s=WC.sentences(text);const t=String(term||"").toLowerCase().split(/\\W+/).filter(x=>x.length>3);return s.filter(x=>t.some(w=>x.toLowerCase().includes(w))).slice(0,5);},
  context(ctx){
    const tasks=[],questions=[],decisions=[],requirements=[];
    for(const d of ctx.documents){tasks.push(...WC.extract.tasks(d.text).map(x=>({text:x,source:d.title,sourceId:d.id})));
      questions.push(...WC.extract.questions(d.text).map(x=>({text:x,source:d.title,sourceId:d.id})));
      decisions.push(...WC.extract.decisions(d.text).map(x=>({text:x,source:d.title,sourceId:d.id})));
      requirements.push(...WC.extract.requirements(d.text).map(x=>({text:x,source:d.title,sourceId:d.id})));
    }
    return {documents:ctx.documents.length,summary:this.summarize(ctx.documents.map(d=>d.text).join("\\n\\n"),12),tasks,questions,decisions,requirements,issues:this.contradictionPairs(ctx.documents),atomicRequirements:this.requirements(ctx),changes:this.changes(ctx)};
  },
  retrieve(ctx,query,limit=8){
    const terms=String(query||"").toLowerCase().split(/\\W+/).filter(x=>x.length>2);
    return ctx.documents.map(d=>({d,score:terms.reduce((n,t)=>n+(d.text.toLowerCase().includes(t)?1:0),0)}))
      .filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.d);
  }
};