import http from 'node:http';
import {timingSafeEqual,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const origin='https://www.seogu.gwangju.kr',limit=10*1024*1024;
function official(value,path){try{const u=new URL(value);return u.origin===origin&&!u.username&&!u.password&&u.pathname===path?u:null;}catch{return null;}}
export async function collect(input,fetcher=fetch){
 const url=official(input.url,'/boardDownload.es');
 if(!url||url.searchParams.get('bid')!=='0013'||!/^\d+$/.test(url.searchParams.get('list_no')||'')||!/^\d+$/.test(url.searchParams.get('seq')||''))throw Error('공식 주요업무계획 첨부파일 주소만 허용됨');
 const post=official(input.postUrl,'/board.es')||new URL('/board.es?mid=a10511040000&bid=0013',origin);
 const headers={'User-Agent':'EventRadar/1.0','Accept':'application/pdf,application/octet-stream,*/*','Referer':post.href};
 try{const r=await fetcher(post.href,{headers:{'User-Agent':headers['User-Agent']},redirect:'manual',signal:AbortSignal.timeout(10000)});if(r.ok){const cookies=(r.headers.getSetCookie?.()||[]).map(c=>c.split(';')[0]).join('; ');if(cookies)headers.Cookie=cookies;}await r.body?.cancel();}catch{}
 const signal=AbortSignal.timeout(45000);let target=url.href;
 for(let i=0;i<4;i++){
  const r=await fetcher(target,{headers,redirect:'manual',signal});
  if(r.status>=300&&r.status<400){const next=new URL(r.headers.get('Location')||'',target);await r.body?.cancel();if(next.origin!==origin||!['/boardDownload.es','/upload/','/file/'].some(p=>next.pathname===p||next.pathname.startsWith(p))||next.username||next.password)throw Error('외부 서버로 이동하는 파일은 수집하지 않음');target=next.href;continue;}
  if(!r.ok){await r.body?.cancel();throw Error('원본 서버 HTTP '+r.status);}
  if(Number(r.headers.get('Content-Length')||0)>limit){await r.body?.cancel();throw Error('10MB 문서 제한');}
  const reader=r.body?.getReader();if(!reader)throw Error('파일 본문 없음');let size=0;const chunks=[];
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('10MB 문서 제한');}chunks.push(value);}
  const bytes=Buffer.concat(chunks.map(c=>Buffer.from(c)));
  if(bytes.subarray(0,5).toString()!=='%PDF-')throw Error('원본 응답이 PDF가 아님');
  return {bytes,url:target,sha256:createHash('sha256').update(bytes).digest('hex'),fetchedAt:new Date().toISOString()};
 }
 throw Error('파일 주소 이동 횟수 초과');
}
export function createCollector({token,fetcher=fetch}){
 if(!token||token.length<24)throw Error('COLLECTOR_TOKEN must contain at least 24 characters');
 let active=0;const cache=new Map();
 return http.createServer(async(req,res)=>{
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  if(req.method==='GET'&&req.url==='/health')return json(200,{service:'seogu-plan-collector',status:'ready'});
  if(req.method!=='POST'||req.url!=='/download')return json(404,{error:'Unknown endpoint'});
  const provided=Buffer.from(String(req.headers.authorization||'')),expected=Buffer.from('Bearer '+token);
  if(provided.length!==expected.length||!timingSafeEqual(provided,expected))return json(401,{error:'Unauthorized'});
  if(active>=2)return json(429,{error:'Collector busy'});
  active++;
  try{let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>8192)return json(413,{error:'Request too large'});}const input=JSON.parse(raw);const key=input.url;let file=cache.get(key);
   if(!file||Date.now()-Date.parse(file.fetchedAt)>15*60*1000){file=await collect(input,fetcher);cache.clear();cache.set(key,file);}
   res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':file.bytes.length,'Cache-Control':'no-store','X-Source-Url':file.url,'X-Source-SHA256':file.sha256,'X-Fetched-At':file.fetchedAt});res.end(file.bytes);
  }catch(e){console.error('collector_failure',JSON.stringify({message:e.message,code:e.cause?.code||e.name}));json(502,{error:e.message,stage:'source_download'});}finally{active--;}
 });
}
if(fileURLToPath(import.meta.url)===process.argv[1])createCollector({token:process.env.COLLECTOR_TOKEN}).listen(Number(process.env.PORT||10000),'0.0.0.0',()=>console.log('Collector ready'));
