window.WC = window.WC || {};
WC.extract = {
  headings(text){return WC.clean(text).split("\n").map(x=>x.trim()).filter(Boolean).filter(x=>/^#{1,6}\s|^\d+(?:\.\d+)*[.)]?\s+|^[A-ZА-ЯЁ][^.!?]{2,100}$/.test(x)).slice(0,200)},
  dates(text){const out=[];const rs=[/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g,/\b(?:0?[1-9]|[12]\d|3[01])\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+\d{4})?\b/gi,/\b(?:сегодня|завтра|послезавтра|вчера)\b/gi];for(const re of rs){let m;while((m=re.exec(text))&&out.length<200)out.push(m[0])}return [...new Set(out)]},
  times(text){return [...new Set((text.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g)||[]))]},
  emails(text){return [...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]))]},
  links(text){return [...new Set((text.match(/https?:\/\/[^\s<>"')]+/gi)||[]))]},
  questions(text){return WC.sentences(text).filter(s=>/[?]$|^(кто|что|когда|где|как|зачем|почему|нужно ли|требуется ли|можно ли|есть ли)\b/i.test(s.trim())).slice(0,150)},
  tasks(text){return WC.sentences(text).filter(s=>/(^|\s)(нужно|необходимо|требуется|подготовить|проверить|согласовать|уточнить|предоставить|сделать|разработать|создать|отправить|провести|добавить|исправить|определить|описать|реализовать)\b/i.test(s.trim())).slice(0,150)},
  decisions(text){return WC.sentences(text).filter(s=>/(решили|решение|согласовано|договорились|утверждено|принято|определили|зафиксировали|постановили)\b/i.test(s)).slice(0,150)},
  requirements(text){return WC.sentences(text).filter(s=>/(должен|должна|должно|обязательно|запрещено|нельзя|требуется|необходимо|обязан|поддерживать|должны)\b/i.test(s)).slice(0,200)},
  participants(text){return [...new Set((text.match(/(?:участники|участвуют|присутствуют|attendees|participants)\s*[:\-]\s*([^\n]+)/gi)||[]).map(x=>x.replace(/^.*?[:\-]\s*/,"").trim()))].slice(0,50)},
  keyTerms(text){const ws=text.toLowerCase().match(/[a-zа-яё][a-zа-яё0-9_-]{4,}/gi)||[],stop=new Set("который которая которые также этого может могут будет были быть если когда где как что чтобы очень уже еще или для при это все один одна одно они мы вы она он его ее их вам нас над под после перед между".split(" ")),c={};for(const w of ws)if(!stop.has(w))c[w]=(c[w]||0)+1;return Object.entries(c).filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1]).slice(0,30).map(([term,count])=>({term,count}))},
  sentences(text){return WC.sentences(text)}
};