window.WC=window.WC||{};
WC.calendar={
  normalize(t){return{title:t.title||t.text||"Рабочая задача",date:t.date||"",time:t.time||"",description:t.description||t.source||""}},
  async createOnCurrentPage(event){
    const e=this.normalize(event);
    const ok=confirm("Создать событие в текущем календаре?\n\n"+e.title+"\n"+(e.date||"Дата не указана")+" "+(e.time||""));
    if(!ok)return{ok:false,cancelled:true};
    return await new Promise(resolve=>{
      WC.api.runtime.sendMessage({type:"PAGE_REQUEST",request:{type:"CREATE_CALENDAR_EVENT",event:e}},r=>{
        const err=WC.api.runtime.lastError;
        resolve(err?{ok:false,error:err.message}:r||{ok:false,error:"Календарь не ответил."});
      });
    });
  }
};
