export type MetricLabels = Record<string,string|number|boolean>;
export type MetricPoint = { name:string; value:number; labels:MetricLabels; timestamp:number };
const counters = new Map<string,number>();
const histograms = new Map<string,{count:number;sum:number;max:number}>();
function key(name:string,labels:MetricLabels){return `${name}|${Object.entries(labels).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${String(v)}`).join(',')}`;}
export function increment(name:string,labels:MetricLabels={},value=1){const k=key(name,labels);counters.set(k,(counters.get(k)??0)+value);return counters.get(k)!;}
export function observe(name:string,value:number,labels:MetricLabels={}){if(!Number.isFinite(value)||value<0)throw new Error('Metric value must be finite and non-negative.');const k=key(name,labels);const h=histograms.get(k)??{count:0,sum:0,max:0};h.count++;h.sum+=value;h.max=Math.max(h.max,value);histograms.set(k,h);return h;}
export function snapshotMetrics():MetricPoint[]{const now=Date.now();const points:MetricPoint[]=[];for(const [k,value] of counters){const [name,raw='']=k.split('|');const labels=Object.fromEntries(raw?raw.split(',').filter(Boolean).map(p=>{const i=p.indexOf('=');return [p.slice(0,i),p.slice(i+1)]}):[]);points.push({name,value,labels,timestamp:now});}for(const [k,h] of histograms){const [name,raw='']=k.split('|');const labels=Object.fromEntries(raw?raw.split(',').filter(Boolean).map(p=>{const i=p.indexOf('=');return [p.slice(0,i),p.slice(i+1)]}):[]);points.push({name:`${name}.avg`,value:h.count?h.sum/h.count:0,labels,timestamp:now});points.push({name:`${name}.max`,value:h.max,labels,timestamp:now});}return points;}
export function resetMetrics(){counters.clear();histograms.clear();}
