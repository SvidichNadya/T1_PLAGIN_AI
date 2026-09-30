window.WC=window.WC||{};
WC.api=globalThis.browser||globalThis.chrome;
WC.uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
WC.clean=s=>String(s||"").replace(/\r/g,"").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim();
WC.words=s=>WC.clean(s).split(/\s+/).filter(Boolean);
WC.sentences=s=>WC.clean(s).split(/(?<=[.!?])\s+/).filter(Boolean);
WC.escape=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
WC.date=s=>{const m=String(s||"").match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/);if(!m)return null;const y=m[3]?Number(m[3].length===2?"20"+m[3]:m[3]):new Date().getFullYear();return new Date(y,Number(m[2])-1,Number(m[1]))};