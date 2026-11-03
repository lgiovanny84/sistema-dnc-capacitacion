export type ChartSeries = {label:string; values:number[]; color:string};
export type ReportChart = {title:string; labels:string[]; series:ChartSeries[]};
// Canvas images are embedded in Excel; source values remain in editable cells.
// No remote service receives institutional data.
export function reportChartImage(chart:ReportChart):string|undefined {
 if(typeof document==='undefined')return;
 const canvas=document.createElement('canvas');if(typeof canvas.getContext!=='function')return;
 canvas.width=1200;canvas.height=Math.max(640,150+chart.labels.length*64);
 const c=canvas.getContext('2d');if(!c)return;
 c.fillStyle='#ffffff';c.fillRect(0,0,canvas.width,canvas.height);
 c.fillStyle='#252C57';c.font='600 30px Arial';c.fillText(chart.title,32,46);
 let lx=32;chart.series.forEach(s=>{c.fillStyle=s.color;c.fillRect(lx,70,18,18);c.fillStyle='#455468';c.font='20px Arial';c.fillText(s.label,lx+26,86);lx+=260;});
 const left=340,right=140,top=125,width=canvas.width-left-right;
 const max=Math.max(1,...chart.series.flatMap(s=>s.values));
 for(let i=0;i<=4;i++){const x=left+width*i/4;c.strokeStyle='#e1e6ed';c.beginPath();c.moveTo(x,top-12);c.lineTo(x,canvas.height-55);c.stroke();c.fillStyle='#526174';c.font='17px Arial';c.fillText(new Intl.NumberFormat('es-EC',{notation:'compact',maximumFractionDigits:1}).format(max*i/4),x-12,canvas.height-22);}
 chart.labels.forEach((label,i)=>{const y=top+i*64;c.fillStyle='#263649';c.font='20px Arial';let text=label;while(c.measureText(text).width>left-48&&text.length>3)text=text.slice(0,-2);c.fillText(text===label?text:text+'…',24,y+25);
 const h=Math.min(20,42/Math.max(1,chart.series.length));chart.series.forEach((s,j)=>{const value=s.values[i]||0;c.fillStyle=s.color;c.fillRect(left,y+j*(h+3),width*value/max,h);c.fillStyle='#263649';c.font='16px Arial';c.fillText(value.toLocaleString('es-EC',{maximumFractionDigits:2}),Math.min(canvas.width-24-c.measureText(value.toLocaleString('es-EC',{maximumFractionDigits:2})).width,left+width*value/max+8),y+j*(h+3)+h-2);});});
 return canvas.toDataURL('image/png').split(',')[1];
}
