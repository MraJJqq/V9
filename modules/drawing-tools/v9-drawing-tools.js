/* V9 drawing tools: isolated overlay; strokes persist per instrument, shared across timeframes. */
export function mountV9DrawingTools({app, onModeChange=()=>{}}){
 if(!app)throw new TypeError("V9 drawing app root is required");
 const canvas=document.createElement("canvas");
 canvas.id="v9-drawing-layer";
 canvas.setAttribute("aria-label","交易图表绘图层");
 const ctx=canvas.getContext("2d");
 const bar=document.createElement("div");
 bar.id="v9-drawing-tools";
 bar.innerHTML='<button type="button" data-action="pen" aria-pressed="false" aria-label="画笔">✏️</button><button type="button" data-action="clear" aria-label="清空">🗑︎</button>';
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
  const pts=s.points;
  ctx.save();ctx.lineCap="round";ctx.lineJoin="round";
  // Smooth the pointer samples into a continuous, translucent highlighter stroke.
  const trace=()=>{
   ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
   if(pts.length===1){ctx.lineTo(pts[0].x+.01,pts[0].y+.01);return;}
   for(let i=1;i<pts.length-1;i++){
    const midX=(pts[i].x+pts[i+1].x)/2,midY=(pts[i].y+pts[i+1].y)/2;
    ctx.quadraticCurveTo(pts[i].x,pts[i].y,midX,midY);
   }
   const last=pts[pts.length-1];ctx.lineTo(last.x,last.y);
  };
  // Soft outer edge, broad marker body, and a faint uneven pigment texture.
  trace();ctx.strokeStyle="rgba(255,224,48,.13)";ctx.lineWidth=8;ctx.stroke();
  trace();ctx.strokeStyle="rgba(255,226,45,.29)";ctx.lineWidth=5.5;ctx.stroke();
  trace();ctx.strokeStyle="rgba(255,245,150,.12)";ctx.lineWidth=2.2;ctx.stroke();
  for(let i=0;i<pts.length;i+=2){
   const p=pts[i],jitter=Math.sin((i+1)*12.9898)*.55;
   ctx.beginPath();ctx.ellipse(p.x+jitter,p.y-jitter*.6,1.05,.65,0,0,Math.PI*2);
   ctx.fillStyle="rgba(255,239,105,.12)";ctx.fill();
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
