window.WC=window.WC||{};
WC.Context=class{
 constructor(){this.key="wc-session";this.data=WC.newContext();this.ready=this.load();}
 async load(){try{const x=await WC.api.storage.session.get(this.key);if(x[this.key]){this.data={...WC.newContext(),...x[this.key]};this.data.development={...WC.newContext().development,...(x[this.key].development||{})};this.data.workTasks=x[this.key].workTasks||x[this.key].tasks||[];this.data.notes=x[this.key].notes||[];this.data.emails=x[this.key].emails||[];this.data.meetings=x[this.key].meetings||[]}}catch(e){}return this.data}
 async save(){this.data.updatedAt=new Date().toISOString();try{await WC.api.storage.session.set({[this.key]:this.data})}catch(e){}}
 async updateDevelopment(p){this.data.development={...this.data.development,...p};return this.save()}
 async addDocument(d){const doc=d?.id?d:WC.newDocument(d);this.data.documents.push(doc);if(doc.type==="mail")this.data.emails.push({documentId:doc.id,title:doc.title,source:doc.sourceReference});if(doc.type==="dion")this.data.meetings.push({id:WC.uid(),title:doc.title,link:doc.url||doc.sourceReference,documentId:doc.id});return this.save()}
 async removeDocument(id){this.data.documents=this.data.documents.filter(x=>x.id!==id);this.data.emails=this.data.emails.filter(x=>x.documentId!==id);this.data.meetings=this.data.meetings.filter(x=>x.documentId!==id);return this.save()}
 async clear(){this.data=WC.newContext();return this.save()}
 async addTask(t){this.data.workTasks.push({...t,id:WC.uid(),createdAt:new Date().toISOString(),status:t.status||"open"});return this.save()}
 async addQuestion(q){this.data.questions.push({...q,id:WC.uid()});return this.save()}
 async addDecision(d){this.data.decisions.push({...d,id:WC.uid()});return this.save()}
 async addNote(n){this.data.notes.push({...n,id:WC.uid(),createdAt:new Date().toISOString()});return this.save()}
};