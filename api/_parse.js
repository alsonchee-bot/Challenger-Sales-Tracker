const XLSX=require('xlsx');
function parseWorkbook(wb,fname){
  var out={file:fname,errors:[],warns:[],week:null};
  var info=wb.Sheets['Information'],txt='';
  if(info){Object.keys(info).forEach(function(k){if(k[0]!=='!'&&info[k].v!=null)txt+=' '+info[k].v})}
  var m=txt.match(/YWD:\s*(\d{2,4})\s*Wk\s*(\d{1,2})/i)||txt.match(/(\d{2,4})\s*Wk\s*(\d{1,2})/i);
  if(!m){out.errors.push('Could not find the week on the Information sheet (expected “Date.Calendar YWD: 26 Wk 39”).');return out}
  var yr=+m[1];if(yr<100)yr+=2000;var wk=+m[2];
  var bm=txt.match(/Brand Name:\s*([^;]+)/i),brand=bm?bm[1].trim():'';if(!brand){out.warns.push('Brand name not found in the file. Type it in the Brand box below.');brand='UNKNOWN'}
  var ex=txt.match(/Executed on:\s*(.*?)(?:\s{2,}|$)/);var exm=txt.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),[^+]*\(\+\d\d:\d\d\)/);
  var ws=null,rows=null,hi=-1;
  for(var si=0;si<wb.SheetNames.length&&hi<0;si++){
    var r=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[si]],{header:1,defval:null,blankrows:true});
    for(var i=0;i<Math.min(r.length,12);i++){if(r[i]&&String(r[i][1]).trim()==='Item ID'){hi=i;rows=r;break}}
  }
  if(hi<0){out.errors.push('Could not find the data table (a header row with “Item ID”).');return out}
  var hdr=rows[hi],sub=rows[hi+1]||[],outlets=[],cols=[],sohOff=[];
  var kind=function(v){v=String(v==null?'':v).trim().toLowerCase();return v==='soh'?'soh':(v==='sell-thru'||v==='sell thru'||v==='sellthru'?'st':'')};
  var totCol=-1;
  for(var c0=0;c0<hdr.length;c0++){if(String(hdr[c0]).trim().toLowerCase()==='total'){totCol=c0;break}}
  var tSoh=-1,tSt=-1;
  if(totCol>=0){if(kind(sub[totCol])==='soh'&&kind(sub[totCol+1])==='st'){tSoh=totCol;tSt=totCol+1}else if(kind(sub[totCol])==='st'&&kind(sub[totCol+1])==='soh'){tSt=totCol;tSoh=totCol+1}}
  var skip=totCol>=0?totCol+2:3;
  for(var c=skip;c<hdr.length;c++){if(hdr[c]!=null&&String(hdr[c]).trim()!==''){
    var k1=kind(sub[c]),k2=kind(sub[c+1]);
    if(!((k1==='soh'&&k2==='st')||(k1==='st'&&k2==='soh'))){out.errors.push('Outlet “'+hdr[c]+'” needs one SOH column and one Sell-Thru column side by side under it.');return out}
    outlets.push(String(hdr[c]).trim());cols.push(c);sohOff.push(k1==='soh'?0:1)}}
  if(!outlets.length){out.errors.push('No outlet columns found.');return out}
  var ids=[],descs=[],soh=[],st=[],tot=null,num=function(v){return typeof v==='number'?v:(v==null||v===''?0:(isNaN(+v)?0:+v))};
  var O=outlets.length,keep=0;
  for(var r2=hi+2;r2<rows.length;r2++){var row=rows[r2]||[];
    if(String(row[0]).trim()==='Total'){if(tSoh>=0)tot={soh:num(row[tSoh]),st:num(row[tSt])};break}
    if(row[1]==null||String(row[1]).trim()==='')continue;
    ids.push(String(row[1]).trim());descs.push(String(row[2]||'').trim());
    for(var o=0;o<O;o++){soh.push(num(row[cols[o]+sohOff[o]]));st.push(num(row[cols[o]+1-sohOff[o]]))}
  }
  if(!ids.length){out.errors.push('No SKU rows found under the header.');return out}
  var ssoh=soh.reduce(function(a,b){return a+b},0),sst=st.reduce(function(a,b){return a+b},0);
  if(tot&&(tot.soh!==ssoh||tot.st!==sst))out.warns.push('Outlet columns add up to '+ssoh+' on hand / '+sst+' sold, but the file’s Total row says '+tot.soh+' / '+tot.st+'.');
  out.week={id:yr+'-W'+(wk<10?'0':'')+wk,year:yr,week:wk,brand:brand,executed:exm?exm[0]:(ex?ex[1]:''),outlets:outlets,skuIds:ids,skuDescs:descs,soh:soh,st:st,source:fname};
  return out
}
function parseBuffer(buf,fname){return parseWorkbook(XLSX.read(buf,{type:'buffer'}),fname)}
module.exports={parseWorkbook,parseBuffer};
