window.WC = window.WC || {};
WC.extract = {
 headings(text){return WC.clean(text).split("\\n").filter(x=>/^#{1,6}\\s|^[A-ZА-ЯЁ][^.!?]{2,100}$/.test(x.trim())).slice(0,100)},
 dates(text){const out=[];const re=/\\b\\d{1,2}[./-]\\d{1,2}(?:[./-]\\d{2,4})?\\b/g;let m;while((m=re.exec(text))&&out.length<100)out.push(m[0]);return [...new Set(out)]},
 emails(text){return [...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi)||[]))]},
 questions(text){return WC.sentences(text).filter(s=>/[?]|^(кто|что|когда|где|как|зачем|почему|нужно ли|требуется ли)\\b/i.test(s)).slice(0,100)},
 tasks(text){return WC.sentences(text).filter(s=>/(нужно|необходимо|требуется|подготовить|проверить|согласовать|уточнить|предоставить|сделать|разработать|создать|отправить|провести)\\b/i.test(s)).slice(0,100)},
 decisions(text){return WC.sentences(text).filter(s=>/(решили|решение|согласовано|договорились|утверждено|принято)\\b/i.test(s)).slice(0,100)}
};