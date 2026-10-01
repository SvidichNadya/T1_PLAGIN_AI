// Единственный список доменов, на которых Work Copilot имеет право читать DOM.
// Формат — Chrome match pattern.
// Примеры: "https://portal.company.ru/*", "https://*.company.ru/*"
// Пустой массив = Work Copilot не читает ни один сайт.
// После изменения списка перезагрузите расширение на chrome://extensions.
// При первом обращении к настроенному домену Chrome запросит host-доступ.

globalThis.WC_DOMAIN_ALLOWLIST = [
  // "https://portal.company.ru/*",
  // "https://*.company.ru/*"
];

globalThis.WC_DOMAIN_ALLOWED = function(url){
  const value=String(url||"");
  return globalThis.WC_DOMAIN_ALLOWLIST.some(pattern=>{
    try{return new URLPattern(pattern).test(value)}
    catch(_){return false}
  });
};
