window.WC = window.WC || {};
WC.ai = {
  available:false,
  async ask(prompt,context){
    return {mode:"deterministic",text:"Локальная языковая модель не подключена. Ниже выполнен безопасный детерминированный анализ доступного контекста.",data:this.fallback(prompt,context)};
  },
  fallback(prompt,ctx){
    const text=ctx.documents.map(d=>d.text).join("\\n\\n");
    const p=String(prompt).toLowerCase();
    if(p.includes("кратко")||p.includes("резюме")||p.includes("сумм")) return this.format(WC.analyze.summarize(text,10));
    if(p.includes("задач")) return this.format(WC.extract.tasks(text));
    if(p.includes("вопрос")) return this.format(WC.extract.questions(text));
    if(p.includes("решен")) return this.format(WC.extract.decisions(text));
    if(p.includes("срок")||p.includes("дат")) return this.format(WC.extract.dates(text));
    return "В текущем режиме доступны структурный анализ, извлечение фактов, задач, вопросов, решений и дат. Для семантического диалога требуется локальная модель, поставляемая отдельно утвержденным офлайн-пакетом.";
  },
  format(a){return Array.isArray(a)&&a.length?a.map(x=>"• "+x).join("\\n"):"Ничего не найдено."}
};