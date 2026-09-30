window.WC = window.WC || {};
WC.Context = class {
 constructor(){this.key="wc-session";this.data=WC.newContext();this.ready=this.load();}
 async load(){try{const x=await chrome.storage.session.get(this.key);if(x[this.key])this.data=x[this.key]}catch(e){}return this.data}
 async save(){this.data.updatedAt=new Date().toISOString();try{await chrome.storage.session.set({[this.key]:this.data})}catch(e){}}
 addDocument(d){this.data.documents.push(WC.newDocument(d));return this.save()}
 removeDocument(id){this.data.documents=this.data.documents.filter(x=>x.id!==id);return this.save()}
 clear(){this.data=WC.newContext();return this.save()}
 addTask(t){this.data.tasks.push({...t,id:WC.uid(),createdAt:new Date().toISOString()});return this.save()}
 addIssue(i){this.data.issues.push({...i,id:WC.uid(),createdAt:new Date().toISOString()});return this.save()}
 addQuestion(q){this.data.questions.push({...q,id:WC.uid(),createdAt:new Date().toISOString()});return this.save()}
};