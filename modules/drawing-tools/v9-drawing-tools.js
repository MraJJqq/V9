/* V9 drawing engine: crayon texture + pause-based shape recognition. */
export function mountV9DrawingTools({app,onModeChange=()=>{}}){
 if(!app)throw new TypeError("V9 drawing app root is required");
 const canvas=document.createElement("canvas");canvas.id="v9-drawing-layer";canvas.setAttribute("aria-label","交易图表绘图层");
 const ctx=canvas.getContext("2d",{alpha:true});
 const bar=document.createElement("div");bar.id="v9-drawing-tools";
 bar.innerHTML='<button type="button" data-action="pen" aria-pressed="false" aria-label="画笔">✏️</button><button type="button" data-action="clear" aria-label="清空">🗑︎</button>';
 app.append(canvas,bar);

 let symbol="",enabled=false,dpr=Math.min(window.devicePixelRatio||1,2),strokes=[],active=null,activeId=null,destroyed=false,holdTimer=null;
 let viewW=1,viewH=1;
 const WIDTH=9,HOLD_MS=450,COLOR=[252,245,85];
 const key=()=> "vegas-v9-drawings:"+encodeURIComponent(symbol);
 const validSymbol=s=>typeof s==="string"&&/^[A-Z0-9_:-]{2,40}$/.test(s);
 const brushCanvas=document.createElement("canvas"),brushCtx=brushCanvas.getContext("2d");
 const tileCanvas=document.createElement("canvas");
 let tilePattern=null,brushKey="",brushGradient=null,brushRadius=0,brushSize=0;
 const S=()=>dpr/3;
 function gauss(src,N,sig){
  const R=Math.ceil(sig*3),k=[];let sum=0;
  for(let i=-R;i<=R;i++){const v=Math.exp(-i*i/(2*sig*sig));k.push(v);sum+=v;}
  const tmp=new Float32Array(N*N),out=new Float32Array(N*N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){let a=0;for(let i=-R;i<=R;i++)a+=src[y*N+(x+i+N)%N]*k[i+R];tmp[y*N+x]=a/sum;}
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){let a=0;for(let i=-R;i<=R;i++)a+=tmp[((y+i+N)%N)*N+x]*k[i+R];out[y*N+x]=a/sum;}
  return out;
 }
 function norm(a){
  let m=0,v=0;a.forEach(x=>m+=x);m/=a.length;
  a.forEach(x=>v+=(x-m)*(x-m));v=Math.sqrt(v/a.length);
  return a.map(x=>(x-m)/v);
 }
 function makeTile(){
  const N=320,rnd=()=>Float32Array.from({length:N*N},Math.random);
  const fine=norm(gauss(rnd(),N,1.3*S())),coarse=norm(gauss(rnd(),N,4*S()));
  const noise=fine.map((x,i)=>x+coarse[i]),idx=Array.from(noise.keys()).sort((a,b)=>noise[a]-noise[b]);
  const curve=[[0,.28],[.02,.43],[.05,.52],[.10,.61],[.25,.75],[.5,.88],[.75,.956],[.9,.988],[1,1]];
  const brightness=new Float32Array(N*N);
  idx.forEach((id,r)=>{
   const q=r/(N*N-1);let j=1;while(curve[j][0]<q)j++;
   const [q0,b0]=curve[j-1],[q1,b1]=curve[j];
   brightness[id]=b0+(b1-b0)*(q-q0)/(q1-q0);
  });
  tileCanvas.width=tileCanvas.height=N;
  const g=tileCanvas.getContext("2d"),im=g.createImageData(N,N);
  for(let i=0;i<N*N;i++){const b=brightness[i];im.data[i*4]=252*b;im.data[i*4+1]=245*b;im.data[i*4+2]=85*Math.pow(b,1.3);im.data[i*4+3]=255;}
  g.putImageData(im,0,0);tilePattern=brushCtx.createPattern(tileCanvas,"repeat");
 }
 makeTile();
 function prepareBrush(r){
  const k=r+"_"+dpr;if(k===brushKey)return;brushKey=k;
  brushRadius=r+2*S();brushSize=Math.ceil(2*brushRadius)+6;
  brushCanvas.width=brushCanvas.height=brushSize;
  brushGradient=brushCtx.createRadialGradient(0,0,0,0,0,brushRadius);
  [[11,1],[9,.95],[7,.88],[5,.74],[3,.45],[2,.2],[1,.05],[0,0]].forEach(([q,a])=>
   brushGradient.addColorStop(Math.max(0,1-q*S()/brushRadius),"rgba(0,0,0,"+a+")"));
 }
 function stamp(x,y,r){
  x*=dpr;y*=dpr;r*=dpr;prepareBrush(r);
  const ix=Math.floor(x-brushRadius-2),iy=Math.floor(y-brushRadius-2);
  brushCtx.setTransform(1,0,0,1,0,0);brushCtx.clearRect(0,0,brushSize,brushSize);
  brushCtx.setTransform(1,0,0,1,-ix,-iy);brushCtx.fillStyle=tilePattern;brushCtx.fillRect(ix,iy,brushSize,brushSize);
  brushCtx.setTransform(1,0,0,1,x-ix,y-iy);brushCtx.globalCompositeOperation="destination-in";
  brushCtx.fillStyle=brushGradient;brushCtx.fillRect(-brushSize,-brushSize,brushSize*2,brushSize*2);
  brushCtx.setTransform(1,0,0,1,0,0);brushCtx.globalCompositeOperation="source-over";
  ctx.save();ctx.globalCompositeOperation="lighten";ctx.drawImage(brushCanvas,ix,iy);ctx.restore();
  brushCtx.globalCompositeOperation="source-over";
 }
 function line(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),step=Math.max(WIDTH*.25,1);
  for(let t=0;t<=dist;t+=step){const q=dist?t/dist:0;stamp(a.x+dx*q,a.y+dy*q,WIDTH/2);}
 }
 function poly(v,close=true){for(let i=1;i<v.length;i++)line(v[i-1],v[i]);if(close&&v.length>2)line(v[v.length-1],v[0]);}
 function ellipse(cx,cy,rx,ry){
  if(Math.abs(rx-ry)/Math.max(rx,ry)<.15)rx=ry=(rx+ry)/2;
  const count=Math.max(40,Math.ceil((rx+ry)/2));let prev={x:cx+rx,y:cy};
  for(let i=1;i<=count;i++){const t=i/count*Math.PI*2,p={x:cx+Math.cos(t)*rx,y:cy+Math.sin(t)*ry};line(prev,p);prev=p;}
 }
 function arrow(A,T,k,n,L){
  if(Math.abs(k)<L*.14)k=0;
  const C={x:(A.x+T.x)/2+n.x*k,y:(A.y+T.y)/2+n.y*k},count=Math.max(12,Math.ceil(L/6));let prev=A;
  for(let i=1;i<=count;i++){const t=i/count,q=1-t,p={x:q*q*A.x+2*q*t*C.x+t*t*T.x,y:q*q*A.y+2*q*t*C.y+t*t*T.y};line(prev,p);prev=p;}
  const ang=Math.atan2(T.y-C.y,T.x-C.x),head=Math.min(Math.max(L*.2,14),40);
  for(const side of [.45,-.45]){const a=ang+Math.PI+side;line(T,{x:T.x+Math.cos(a)*head,y:T.y+Math.sin(a)*head});}
 }
 function drawStroke(s){
  const p=s.points;if(!p?.length)return;
  const shape=s.shape;
  if(shape?.type==="line")line(shape.a,shape.b);
  else if(shape?.type==="arrow")arrow(shape.a,shape.b,shape.k,shape.n,shape.length);
  else if(shape?.type==="rect"||shape?.type==="tri")poly(shape.points);
  else if(shape?.type==="ellipse")ellipse(shape.cx,shape.cy,shape.rx,shape.ry);
  else if(p.length===1)stamp(p[0].x,p[0].y,WIDTH/2);
  else for(let i=1;i<p.length;i++)line(p[i-1],p[i]);
 }
 function redraw(){
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
  if(destroyed)return;
  for(const s of strokes)drawStroke(s);if(active)drawStroke(active);
  ctx.setTransform(1,0,0,1,0,0);
 }
 function save(){if(!symbol)return;try{localStorage.setItem(key(),JSON.stringify(strokes));}catch(e){console.warn("[VEGAS V9 drawing] save failed",e);}}
 function clearHold(){if(holdTimer!==null){clearTimeout(holdTimer);holdTimer=null;}}
 function finishActive(){clearHold();if(active?.points?.length){strokes.push(active);save();}active=null;activeId=null;}
 function resize(){
  const rect=app.getBoundingClientRect(),nextDpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,rect.width),h=Math.max(1,rect.height);
  if(viewW!==w||viewH!==h){const sx=w/viewW,sy=h/viewH;const scalePoint=p=>({x:p.x*sx,y:p.y*sy});
   const scaleShape=s=>{if(!s)return s;const z={...s};for(const k of ["a","b"])if(z[k])z[k]=scalePoint(z[k]);if(z.points)z.points=z.points.map(scalePoint);if(z.type==="ellipse"){z.cx*=sx;z.cy*=sy;z.rx*=sx;z.ry*=sy;}if(z.type==="arrow"){z.k*=Math.hypot(sx,sy)/Math.SQRT2;z.length*=Math.hypot(sx,sy)/Math.SQRT2;}return z;};
   strokes=strokes.map(s=>({...s,points:s.points.map(scalePoint),shape:scaleShape(s.shape)}));
   if(active)active={...active,points:active.points.map(scalePoint),shape:scaleShape(active.shape)};
   viewW=w;viewH=h;save();
  }
  dpr=nextDpr;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  canvas.style.width=w+"px";canvas.style.height=h+"px";brushKey="";redraw();
 }
 function load(next){
  clearHold();active=null;symbol=validSymbol(next)?next:"";
  try{const data=symbol?JSON.parse(localStorage.getItem(key())||"[]"):[];strokes=Array.isArray(data)?data.filter(s=>Array.isArray(s.points)&&s.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))):[];}
  catch(_){strokes=[];}
  redraw();
 }
 function setEnabled(value){
  enabled=Boolean(value);bar.querySelector('[data-action="pen"]').setAttribute("aria-pressed",String(enabled));
  canvas.style.pointerEvents=enabled?"auto":"none";canvas.style.touchAction=enabled?"none":"auto";onModeChange(enabled);
 }
 const point=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
 function armRecognition(){clearHold();holdTimer=setTimeout(()=>{holdTimer=null;recognize();},HOLD_MS);}
 function recognizeOpen(){
  const p=active.points,A=p[0],E=p[p.length-1];let ti=0,L=0;
  p.forEach((q,i)=>{const d=Math.hypot(q.x-A.x,q.y-A.y);if(d>L){L=d;ti=i;}});
  if(L<30)return;const T=p[ti],dx=(T.x-A.x)/L,dy=(T.y-A.y)/L,n={x:-dy,y:dx};
  let sb=0,sbb=0;const seg=p.slice(0,ti+1).map(q=>{const u=Math.max(0,Math.min(1,((q.x-A.x)*dx+(q.y-A.y)*dy)/L));return{b:2*u*(1-u),v:(q.x-A.x)*n.x+(q.y-A.y)*n.y};});
  for(const q of seg){sb+=q.b*q.v;sbb+=q.b*q.b;}const k=sbb?sb/sbb:0,dev=Math.abs(k)/2;
  const residual=seg.reduce((m,q)=>m+Math.abs(q.v-q.b*k),0)/seg.length;
  if(residual>L*.1||dev>L*.4)return;
  const back=Math.hypot(E.x-T.x,E.y-T.y),isArrow=back>L*.08&&back<L*.6;
  if(!isArrow&&dev>L*.1)return;
  active.shape=isArrow?{type:"arrow",a:A,b:T,k,n,length:L}:{type:"line",a:A,b:T};
  active.locked=true;redraw();
 }
 function hull(points){
  const p=points.map(q=>({x:q.x,y:q.y})).sort((a,b)=>a.x-b.x||a.y-b.y);
  const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x),lo=[],up=[];
  for(const q of p){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),q)<=0)lo.pop();lo.push(q);}
  for(let i=p.length-1;i>=0;i--){const q=p[i];while(up.length>1&&cross(up.at(-2),up.at(-1),q)<=0)up.pop();up.push(q);}
  return lo.slice(0,-1).concat(up.slice(0,-1));
 }
 function polygonArea(p){let a=0;for(let i=0;i<p.length;i++){const q=p[i],r=p[(i+1)%p.length];a+=q.x*r.y-r.x*q.y;}return Math.abs(a)/2;}
 function rectAt(h,t){
  const c=Math.cos(t),s=Math.sin(t);let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;
  for(const p of h){const u=p.x*c+p.y*s,v=-p.x*s+p.y*c;u0=Math.min(u0,u);u1=Math.max(u1,u);v0=Math.min(v0,v);v1=Math.max(v1,v);}
  const f=(u,v)=>({x:u*c-v*s,y:u*s+v*c});
  return{area:(u1-u0)*(v1-v0),points:[f(u0,v0),f(u1,v0),f(u1,v1),f(u0,v1)]};
 }
 function rdp(p,eps){
  if(p.length<3)return p;const a=p[0],b=p.at(-1),L=Math.hypot(b.x-a.x,b.y-a.y)||1;let max=0,mi=0;
  for(let i=1;i<p.length-1;i++){const d=Math.abs((b.x-a.x)*(a.y-p[i].y)-(a.x-p[i].x)*(b.y-a.y))/L;if(d>max){max=d;mi=i;}}
  if(max<=eps)return[a,b];return rdp(p.slice(0,mi+1),eps).slice(0,-1).concat(rdp(p.slice(mi),eps));
 }
 function triangleCandidate(points,diag){
  for(const e of [.08,.11,.15,.2]){
   const v=rdp(points.concat([points[0]]),diag*e);if(v.length===4)return v.slice(0,3);
  }return null;
 }
 function recognizeClosed(){
  const p=active.points;if(p.length<5)return;
  const xs=p.map(q=>q.x),ys=p.map(q=>q.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const w=x1-x0,h=y1-y0,diag=Math.hypot(w,h);if(Math.min(w,h)<25)return;
  const hullPoints=hull(p),hArea=polygonArea(hullPoints);let best=null,bestAngle=0;
  for(let d=0;d<90;d++){const r=rectAt(hullPoints,d*Math.PI/180);if(!best||r.area<best.area){best=r;bestAngle=d;}}
  if(!best?.area)return;const ratio=hArea/best.area,cx=(x0+x1)/2,cy=(y0+y1)/2,rx=w/2,ry=h/2;
  const err=p.reduce((sum,q)=>sum+Math.abs(Math.hypot((q.x-cx)/rx,(q.y-cy)/ry)-1),0)/p.length;
  let shape=null;
  if(ratio>=.86){shape={type:"rect",points:(bestAngle<=7||bestAngle>=83)?rectAt(hullPoints,0).points:best.points};}
  else if(ratio>=.68&&err<.25)shape={type:"ellipse",cx,cy,rx,ry};
  else if(ratio<.8){const tri=triangleCandidate(p,diag);if(tri)shape={type:"tri",points:tri};}
  if(shape){active.shape=shape;active.locked=true;redraw();}
 }
 function recognize(){
  if(!active||active.points.length<5)return;
  const p=active.points,A=p[0],E=p.at(-1),xs=p.map(q=>q.x),ys=p.map(q=>q.y),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys),diag=Math.hypot(w,h);
  const closed=Math.hypot(A.x-E.x,A.y-E.y)<diag*.35&&Math.min(w,h)>25;
  if(closed)recognizeClosed();else recognizeOpen();
 }
 function down(e){
  if(!enabled||!symbol||activeId!==null)return;
  const y=e.clientY,h=window.innerHeight;if(y<Math.min(72,h*.11)||y>h-Math.min(110,h*.18))return;
  e.preventDefault();activeId=e.pointerId;try{canvas.setPointerCapture(e.pointerId);}catch(_){}
  active={points:[point(e)],shape:null,locked:false};stamp(active.points[0].x,active.points[0].y,WIDTH/2);
 }
 function move(e){
  if(!active||!enabled||e.pointerId!==activeId)return;e.preventDefault();
  const events=e.getCoalescedEvents?.()||[e];
  for(const ev of events){
   const p=point(ev),last=active.points.at(-1);if(Math.hypot(p.x-last.x,p.y-last.y)<1.5)continue;
   if(active.locked&&active.shape?.type==="line"){
    const s=active.shape,dx=p.x-s.b.x,dy=p.y-s.b.y,back=Math.hypot(dx,dy),along=-(dx*Math.cos(Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x))+dy*Math.sin(Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x)));
    if(along>s.length*.08&&back<s.length*.6){clearHold();holdTimer=setTimeout(()=>{holdTimer=null;if(active&&active.shape?.type==="line"){active.shape={type:"arrow",a:s.a,b:s.b,k:0,n:{x:-(s.b.y-s.a.y)/s.length,y:(s.b.x-s.a.x)/s.length},length:s.length};redraw();}},HOLD_MS);}
    continue;
   }
   if(active.locked)continue;
   line(last,p);active.points.push(p);armRecognition();
  }
 }
 function up(e){
  if(e.pointerId!==activeId)return;
  try{if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}catch(_){}
  finishActive();
 }
 bar.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.action==="pen")setEnabled(!enabled);
  if(b.dataset.action==="clear"){clearHold();active=null;strokes=[];save();redraw();}
 });
 canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);
 canvas.addEventListener("pointerup",up);canvas.addEventListener("pointercancel",up);
 canvas.addEventListener("contextmenu",e=>e.preventDefault());
 const preventGesture=e=>e.preventDefault();document.addEventListener("gesturestart",preventGesture);document.addEventListener("gesturechange",preventGesture);
 const observer=new ResizeObserver(resize);observer.observe(app);resize();
 function refreshLayout(){if(!destroyed){resize();bar.getBoundingClientRect();}}
 function destroy(){
  if(destroyed)return;destroyed=true;clearHold();if(active?.points?.length){strokes.push(active);save();}
  active=null;activeId=null;observer.disconnect();document.removeEventListener("gesturestart",preventGesture);document.removeEventListener("gesturechange",preventGesture);
  canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerup",up);canvas.removeEventListener("pointercancel",up);
  canvas.remove();bar.remove();onModeChange(false);
 }
 return Object.freeze({setSymbol:load,refreshLayout,destroy,get enabled(){return enabled;}});
}
