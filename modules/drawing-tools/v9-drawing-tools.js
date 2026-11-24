/* V9 drawing tools: isolated overlay; strokes persist per instrument, shared across timeframes. */
export function mountV9DrawingTools({app, onModeChange=()=>{}}){
 if(!app)throw new TypeError("V9 drawing app root is required");
 const canvas=document.createElement("canvas");
 canvas.id="v9-drawing-layer";
 canvas.setAttribute("aria-label","交易图表绘图层");
 const ctx=canvas.getContext("2d");
 const bar=document.createElement("div");
 bar.id="v9-drawing-tools";
 bar.innerHTML='<button type="button" data-action="pen" aria-pressed="false" aria-label="画笔">✏️</button><button type="button" data-action="clear" aria-label="清空">🗑️</button>';
 app.append(canvas,bar);
 let symbol="",enabled=false,dpr=1,strokes=[],active=null,destroyed=false;
 const key=()=> "vegas-v9-drawings:"+encodeURIComponent(symbol);
 const validSymbol=s=>typeof s==="string"&&/^[A-Z0-9_:-]{2,40}$/.test(s);
 function resize(){
  const oldW=canvas.width/dpr||1,oldH=canvas.height/dpr||1;
  const rect=app.getBoundingClientRect();dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));
  canvas.style.width=rect.width+"px";canvas.style.height=rect.height+"px";
  if(oldW!==rect.width||oldH!==rect.height){
   strokes=strokes.map(s=>({...s,points:s.points.map(p=>({x:p.x*rect.width/oldW,y:p.y*rect.height/oldH}))}));
  }
  redraw();
 }
 function paintStroke(s){
  if(!s.points.length)return;
  ctx.save();ctx.lineCap="round";ctx.lineJoin="round";
  ctx.strokeStyle="rgba(255,226,35,.27)";ctx.lineWidth=2.2;ctx.beginPath();
  s.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
  ctx.strokeStyle="rgba(255,226,35,.22)";ctx.lineWidth=1.3;ctx.beginPath();
  s.points.forEach((p,i)=>i?ctx.lineTo(p.x+.25,p.y-.15):ctx.moveTo(p.x+.25,p.y-.15));ctx.stroke();
  for(let i=0;i<s.points.length;i++){
   const p=s.points[i];
   for(let j=0;j<3;j++){
    const seed=Math.sin((i+1)*127.1+(j+1)*311.7)*43758.5453,rand=seed-Math.floor(seed);
    const a=(rand-.5)*2.6,b=(Math.sin(seed*1.7)-Math.floor(Math.sin(seed*1.7)))*2.2;
    ctx.fillStyle="rgba(255,226,35,.22)";ctx.fillRect(p.x+a,p.y+b,.8,.8);
   }
  }
  ctx.restore();
 }
 function redraw(){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,canvas.width/dpr,canvas.height/dpr);
  strokes.forEach(paintStroke);if(active)paintStroke(active);
 }
 function save(){if(!symbol)return;try{localStorage.setItem(key(),JSON.stringify(strokes))}catch(e){console.warn("[VEGAS V9 drawing] save failed",e)}}
 function load(next){
  symbol=validSymbol(next)?next:"";
  try{const data=symbol?JSON.parse(localStorage.getItem(key())||"[]"):[];strokes=Array.isArray(data)?data.filter(s=>Array.isArray(s.points)&&s.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))):[]}catch(_){strokes=[]}
  active=null;redraw();
 }
 function setEnabled(value){
  enabled=Boolean(value);bar.querySelector('[data-action="pen"]').setAttribute("aria-pressed",String(enabled));
  canvas.style.pointerEvents=enabled?"auto":"none";
  canvas.style.touchAction=enabled?"none":"auto";onModeChange(enabled);
 }
 function point(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
 function down(e){
  if(!enabled||!symbol)return;
  const y=e.clientY, h=window.innerHeight;
  if(y<Math.min(72,h*.11)||y>h-Math.min(110,h*.18))return;
  e.preventDefault();canvas.setPointerCapture(e.pointerId);active={points:[point(e)]};redraw();
 }
 function move(e){if(!active||!enabled)return;e.preventDefault();const p=point(e),last=active.points.at(-1);if(Math.hypot(p.x-last.x,p.y-last.y)<1)return;active.points.push(p);redraw()}
 function up(e){if(!active)return;try{if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId)}catch(_){}if(active.points.length)strokes.push(active);active=null;save();redraw()}
 bar.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.action==="pen")setEnabled(!enabled);
  if(b.dataset.action==="clear"){strokes=[];active=null;save();redraw()}
 });
 canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",up);canvas.addEventListener("pointercancel",up);
 const observer=new ResizeObserver(resize);observer.observe(app);resize();
 function destroy(){if(destroyed)return;destroyed=true;save();observer.disconnect();canvas.remove();bar.remove()}
 return Object.freeze({setSymbol:load,destroy,get enabled(){return enabled}});
}
