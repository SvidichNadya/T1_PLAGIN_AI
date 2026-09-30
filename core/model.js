window.WC = window.WC || {};
WC.newContext = () => ({version:1,id:WC.uid(),name:"Новая рабочая задача",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),documents:[],tasks:[],issues:[],decisions:[],questions:[],meetings:[],messages:[]});
WC.newDocument = (d={}) => ({id:WC.uid(),type:d.type||"web",title:d.title||"Без названия",author:d.author||"",date:d.date||"",url:d.url||"",text:d.text||"",addedAt:new Date().toISOString(),facts:[],questions:[],tasks:[],decisions:[],issues:[]});
