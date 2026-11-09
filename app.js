import {SX,SY,CENTRAL,neighborhood,dot,responses} from './core.js';
const $=id=>document.getElementById(id);
const input=$('input'),output=$('output'),ic=input.getContext('2d'),oc=output.getContext('2d');
let source=null,w=48,h=36,gray,values,at=0,running=false,last=0,credit=0,loadVersion=0;
let scale=1,cachedMode=null;
const grayCanvas=document.createElement('canvas'),edgeCanvas=document.createElement('canvas');
function cacheImages(){
  grayCanvas.width=edgeCanvas.width=w;grayCanvas.height=edgeCanvas.height=h;
  const pixels=new ImageData(w,h);
  for(let i=0;i<gray.length;i++){pixels.data[4*i]=pixels.data[4*i+1]=pixels.data[4*i+2]=gray[i];pixels.data[4*i+3]=255;}
  grayCanvas.getContext('2d').putImageData(pixels,0,0);cachedMode=null;
}
function cacheResponse(mode){
  const a=values[mode],max=a.reduce((m,v)=>Math.max(m,Math.abs(v)),1),pixels=new ImageData(w,h);
  for(let i=0;i<a.length;i++){const j=4*i;if(mode==='magnitude'){pixels.data[j]=pixels.data[j+1]=pixels.data[j+2]=Math.round(255*a[i]/max);}else{const t=Math.abs(a[i])/max,end=a[i]<0?[36,100,184]:[211,103,32];for(let k=0;k<3;k++)pixels.data[j+k]=Math.round(245+(end[k]-245)*t);}pixels.data[j+3]=255;}
  edgeCanvas.getContext('2d').putImageData(pixels,0,0);cachedMode=mode;
}
function pause(){running=false;$('play').textContent='Play';}
function example(){pause();loadVersion++;const c=document.createElement('canvas');c.width=320;c.height=240;const ctx=c.getContext('2d');ctx.fillStyle='#253b46';ctx.fillRect(0,0,320,240);ctx.fillStyle='#e8e5d3';ctx.fillRect(55,40,105,155);ctx.fillStyle='#8faaa4';ctx.beginPath();ctx.arc(226,125,57,0,2*Math.PI);ctx.fill();source=c;$('fileStatus').textContent='Example image';prepare();}
function prepare(){pause();document.body.classList.add('has-image');$('editor').hidden=false;w=Number($('resolution').value);h=Math.max(3,Math.round(w*source.height/source.width));if(h>1024){w=Math.max(3,Math.round(w*1024/h));h=1024;}const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,w,h);ctx.drawImage(source,0,0,w,h);const rgba=ctx.getImageData(0,0,w,h).data;gray=new Uint8Array(w*h);for(let i=0;i<gray.length;i++)gray[i]=Math.round(.2126*rgba[4*i]+.7152*rgba[4*i+1]+.0722*rgba[4*i+2]);values=responses(gray,w,h);scale=Math.max(1,Math.floor(768/Math.max(w,h)));input.width=output.width=w*scale;input.height=output.height=h*scale;ic.imageSmoothingEnabled=oc.imageSmoothingEnabled=false;cacheImages();$('dimensions').textContent=`${w} × ${h} pixels`;$('scrub').max=w*h-1;at=0;render();}
function matrix(data,intensity=false){const box=document.createElement('div');box.className='matrix';data.forEach((v,i)=>{const cell=document.createElement('div');cell.className='cell'+(i===4?' center':'');cell.textContent=String(v);if(intensity){cell.style.background=`rgb(${v},${v},${v})`;cell.style.color=v>135?'#152d37':'white';}box.append(cell);});return box;}
function group(title,data,intensity){const el=document.createElement('div');el.className='matrix-group';const caption=document.createElement('p');caption.className='matrix-title';caption.textContent=title;el.append(caption,matrix(data,intensity));return el;}
function calculation(kernel,name,p){const row=document.createElement('div');row.className='calc-row';const products=p.map((v,i)=>v*kernel[i]);const symbol=t=>{const s=document.createElement('span');s.className='symbol';s.textContent=t;return s;};const sum=document.createElement('strong');sum.className='sum';sum.textContent=dot(p,kernel);row.append(group('Pixels',p,true),symbol('×'),group(name,kernel),symbol('='),group('Products',products),symbol('Σ'),sum);const expr=document.createElement('div');expr.className='expression';expr.textContent=products.map(v=>v<0?`(${v})`:v).join(' + ')+' = '+dot(p,kernel);row.append(expr);return row;}
function render(){
  const mode=$('operator').value,a=values[mode],x=at%w,y=Math.floor(at/w);
  if(cachedMode!==mode)cacheResponse(mode);
  ic.drawImage(grayCanvas,0,0,input.width,input.height);oc.fillStyle='#d9d9de';oc.fillRect(0,0,output.width,output.height);
  if(y>0)oc.drawImage(edgeCanvas,0,0,w,y,0,0,w*scale,y*scale);
  oc.drawImage(edgeCanvas,0,y,x+1,1,0,y*scale,(x+1)*scale,scale);
  const stroke=Math.max(1,Math.max(w,h)/400);
  ic.strokeStyle='#ffb547';ic.lineWidth=stroke;ic.strokeRect((x-1)*scale,(y-1)*scale,3*scale,3*scale);oc.strokeStyle='#ffb547';oc.lineWidth=stroke;oc.strokeRect(x*scale,y*scale,Math.max(1,scale),Math.max(1,scale));
  $('position').textContent=`x = ${x}, y = ${y}`;$('progressLabel').textContent=`${at+1} / ${w*h}`;$('scrub').value=at;$('back').disabled=at===0;$('step').disabled=at===w*h-1;
  const p=neighborhood(gray,w,h,x,y);$('calculations').replaceChildren();if(mode==='magnitude'||mode==='x')$('calculations').append(calculation(SX,'Sₓ',p));if(mode==='magnitude'||mode==='y')$('calculations').append(calculation(SY,'Sᵧ',p));if(mode==='central')$('calculations').append(calculation(CENTRAL,'Kₓ (h = 1)',p));
  $('result').textContent=mode==='magnitude'?`|∇I| = √((${values.x[at]})² + (${values.y[at]})²) = ${a[at].toFixed(2)}`:`${mode==='x'?'Gₓ':mode==='y'?'Gᵧ':'Dₓ'} = ${a[at]} (raw response)`;
}
function advance(n){at=Math.min(w*h-1,Math.max(0,at+n));if(at===w*h-1)pause();render();}
function frame(time){if(running){const delta=Math.min(250,time-last);credit+=delta*Number($('speed').value)/1000;const n=Math.floor(credit);if(n){credit-=n;advance(n);}}last=time;requestAnimationFrame(frame);}
$('play').onclick=()=>{if(running)pause();else{if(at===w*h-1)at=0;running=true;credit=0;last=performance.now();$('play').textContent='Pause';render();}};
$('step').onclick=()=>{pause();advance(1);};$('back').onclick=()=>{pause();advance(-1);};$('reset').onclick=()=>{pause();at=0;render();};$('finish').onclick=()=>{pause();at=w*h-1;render();};$('scrub').oninput=()=>{pause();at=Number($('scrub').value);render();};$('operator').onchange=()=>{pause();render();};$('resolution').onchange=()=>{if(source)prepare();};$('sample').onclick=example;
input.onclick=e=>{pause();const r=input.getBoundingClientRect();const x=Math.min(w-1,Math.max(0,Math.floor((e.clientX-r.left)/r.width*w))),y=Math.min(h-1,Math.max(0,Math.floor((e.clientY-r.top)/r.height*h)));at=y*w+x;render();};
$('upload').onchange=async e=>{const file=e.target.files[0];if(!file)return;pause();const version=++loadVersion;if(!file.type.startsWith('image/')){$('fileStatus').textContent='Choose a supported image file.';return;}if(file.size>30*1024*1024){$('fileStatus').textContent='Choose an image smaller than 30 MB.';return;}const url=URL.createObjectURL(file);try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});if(version!==loadVersion)return;source=img;prepare();$('fileStatus').textContent=`${file.name}`;}catch{if(version===loadVersion)$('fileStatus').textContent='This image could not be read. Try PNG, JPEG, or WebP.';}finally{URL.revokeObjectURL(url);e.target.value='';}};
requestAnimationFrame(frame);
