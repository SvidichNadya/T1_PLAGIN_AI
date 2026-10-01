globalThis.WC=globalThis.WC||{};WC.LLM=WC.LLM||{};
WC.LLM.MAX_TEXT=20000;
WC.LLM.validatePlan=function(value,toolNames){
 if(!value||typeof value!=="object")return{ok:false,error:"План модели должен быть объектом."};
 if(value.done===true)return{ok:true,value:{done:true}};
 if(typeof value.tool!=="string"||!toolNames.includes(value.tool))return{ok:false,error:"Модель выбрала неизвестный инструмент."};
 if(value.args!==undefined&&(value.args===null||typeof value.args!=="object"||Array.isArray(value.args)))return{ok:false,error:"Аргументы инструмента имеют недопустимую схему."};
 return{ok:true,value:{tool:value.tool,args:value.args||{}}};
};
WC.LLM.validateSynthesis=function(value){
 if(!value||typeof value!=="object"||typeof value.text!=="string")return{ok:false,error:"Ответ synthesizer должен содержать text."};
 return{ok:true,value:{text:value.text.slice(0,WC.LLM.MAX_TEXT)}};
};
WC.LLM.createProvider=function(adapter){
 if(!adapter||typeof adapter.plan!=="function"||typeof adapter.synthesize!=="function")throw Error("Local LLM adapter должен реализовать plan и synthesize.");
 return{
  async plan(input){const v=WC.LLM.validatePlan(await adapter.plan(input),(input.tools||[]).map(x=>x.name));if(!v.ok)throw Error(v.error);return v.value},
  async synthesize(input){const v=WC.LLM.validateSynthesis(await adapter.synthesize(input));if(!v.ok)throw Error(v.error);return v.value}
 };
};