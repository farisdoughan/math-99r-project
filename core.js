export const SX = [-1,0,1,-2,0,2,-1,0,1];
export const SY = [-1,-2,-1,0,0,0,1,2,1];
export const CENTRAL = [0,0,0,-0.5,0,0.5,0,0,0];
export function neighborhood(data,w,h,x,y){
  const out=[];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)out.push(data[Math.max(0,Math.min(h-1,y+dy))*w+Math.max(0,Math.min(w-1,x+dx))]);
  return out;
}
export function dot(a,b){return a.reduce((sum,value,i)=>sum+value*b[i],0);}
export function responses(data,w,h){
  const gx=new Float64Array(w*h),gy=new Float64Array(w*h),magnitude=new Float64Array(w*h),central=new Float64Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,p=neighborhood(data,w,h,x,y);gx[i]=dot(p,SX);gy[i]=dot(p,SY);magnitude[i]=Math.hypot(gx[i],gy[i]);central[i]=dot(p,CENTRAL);}
  return {x:gx,y:gy,magnitude,central};
}
