window.WC=window.WC||{};
WC.requirements={
  stop:new Set("который которая которые также этого может могут будет были быть если когда где как что чтобы очень уже еще или для при это все один одна одно они мы вы она он его ее их вам нас над под после перед между является должен должна должны необходимо требуется требуется запрет запрещено нельзя можно".split(" ")),
  atomicize(text,sourceId,sourceTitle){
    return WC.sentences(text).filter(s=>/(должен|должна|должно|должны|обязан|обязана|обязаны|требуется|необходимо|нельзя|запрещено|можно|поддерживать|реализовать|обеспечить|предусмотреть|допускается|не допускается)/i.test(s))
      .map((raw,i)=>this.parse(raw,sourceId,sourceTitle,i+1));
  },
  parse(raw,sourceId,sourceTitle,index){
    const neg=/\b(не\s+должен|не\s+должна|не\s+должны|запрещено|нельзя|не\s+допускается)\b/i.test(raw);
    const action=(raw.match(/\b(должен|должна|должны|обязан|обязана|обязаны|требуется|необходимо|поддерживать|реализовать|обеспечить|предусмотреть|допускается|можно)\b\s+([^.;,]+)/i)||[])[2]||raw;
    const condition=(raw.match(/\b(если|при условии|в случае|при|когда|после|до)\s+([^.;]+)/i)||[])[0]||"Не определено";
    const dates=WC.extract.dates(raw);
    const people=(raw.match(/\b(ответственный|исполнитель|владелец|заказчик)\s*[:\-]?\s*([^,.;]+)/i)||[])[2]||"Не определено";
    const object=this.object(raw,action);
    return {id:sourceId+"-REQ-"+index,raw,sourceId,source:sourceTitle,object,action:action.trim(),condition,restriction:neg?"Запрет/отрицательное требование":"Не определено",deadline:dates[0]||"Не определено",responsible:people.trim(),status:this.status(raw),type:neg?"constraint":"requirement"};
  },
  object(raw,action){
    const verbs="должен|должна|должны|обязан|обязана|обязаны|требуется|необходимо|поддерживать|реализовать|обеспечить|предусмотреть|допускается|можно";
    const m=raw.match(new RegExp("^(.{2,100}?)\\s+(?:"+verbs+")\\b","i"));
    if(m)return m[1].trim().replace(/^[\d.)#-]+\s*/,"");
    const words=action.match(/[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё0-9_-]{2,}/g)||[];
    return words.slice(0,4).join(" ")||"Не определено";
  },
  status(raw){if(/\b(реализован|выполнен|готов|закрыт|утвержден)\b/i.test(raw))return"done";if(/\b(планируется|будет|предстоит)\b/i.test(raw))return"planned";return"not-defined"},
  trace(docs){
    const req=docs.flatMap(d=>this.atomicize(d.text,d.id,d.title));
    const links=[];
    for(let i=0;i<req.length;i++)for(let j=i+1;j<req.length;j++){
      const a=req[i],b=req[j];const score=this.sim(a.raw,b.raw);
      if(score>=0.32)links.push({a:a.id,b:b.id,sourceA:a.source,sourceB:b.source,score:+score.toFixed(2),relation:a.raw===b.raw?"same":"related"});
    }
    return {requirements:req,links};
  },
  sim(a,b){
    const wa=new Set((a.toLowerCase().match(/[а-яёa-z]{4,}/g)||[]).filter(x=>!this.stop.has(x)));
    const wb=new Set((b.toLowerCase().match(/[а-яёa-z]{4,}/g)||[]).filter(x=>!this.stop.has(x)));
    let common=0;for(const w of wb)if(wa.has(w))common++;
    return common/Math.max(1,Math.min(wa.size,wb.size));
  },
  coverage(base,target){
    const A=this.atomicize(base.text,base.id,base.title),B=this.atomicize(target.text,target.id,target.title);
    return {base:base.title,target:target.title,covered:A.filter(a=>B.some(b=>this.sim(a.raw,b.raw)>=0.32)),missing:A.filter(a=>!B.some(b=>this.sim(a.raw,b.raw)>=0.32)),newInTarget:B.filter(b=>!A.some(a=>this.sim(a.raw,b.raw)>=0.32))};
  }
};