'use strict';
/* ─── shared utils ─────────────────────────────── */
const $=id=>document.getElementById(id);
function toast(msg,ms=2800){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),ms)}
function ago(d){if(!d)return '—';const s=(Date.now()-new Date(d))/1000;if(s<60)return 'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';if(s<2592000)return Math.floor(s/86400)+'d ago';return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
function fmtDate(d){if(!d)return '';return new Date(d).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function fmtShort(d){if(!d)return '';return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
function ini(n){return(n||'??').slice(0,2).toUpperCase()}
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function stOf(pr){if(pr.pull_request?.merged_at||pr.merged_at)return 'merged';return pr.state||'open'}

/* ─── tab switching ────────────────────────────── */
function switchTab(name){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  $('tab-'+name).classList.add('active');
  $('panel-'+name).classList.add('active');
}

/* ─── status helpers ───────────────────────────── */
const SVGS={idle:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',ok:'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',err:'<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',load:'<path d="M21 12a9 9 0 1 1-6.219-8.56"/>'};
function mkSt(elId,html,type='idle'){const el=$(elId);el.className='status s-'+(type==='loading'?'load':type);const sp=type==='loading'?' style="animation:rota .65s linear infinite"':'';el.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${sp}>${SVGS[type==='loading'?'load':type]||SVGS.idle}</svg><span>${html}</span>`}
function setSt(h,t){mkSt('statusEl',h,t)}
function setProg(cur,tot,lbl){const w=$('progEl');if(!tot){w.style.display='none';return}w.style.display='block';const p=tot?Math.round((cur/tot)*100):0;$('progLbl').textContent=lbl||`Scanning ${cur} of ${tot}…`;$('progPct').textContent=p+'%';$('progFill').style.width=p+'%'}

/* ═══════════════════════════════════════════════
   GITHUB TAB
═══════════════════════════════════════════════ */
let ALL=[], FILT=[], PAGE=1, REPOS_META=[];
const PG=25;

async function ghFetch(url,token){
  const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
  const d=await r.json();if(!r.ok)throw new Error(d.message||`HTTP ${r.status}`);return d;
}
async function ghPages(base,token){
  let out=[],pg=1;
  while(true){const sep=base.includes('?')?'&':'?';const d=await ghFetch(`${base}${sep}per_page=100&page=${pg}`,token);if(!Array.isArray(d)||!d.length)break;out.push(...d);if(d.length<100)break;pg++;}
  return out;
}

async function connect(){
  const token=$('tokInput').value.trim(),org=$('orgInp').value.trim(),pref=$('prefInp').value.trim(),label=$('lblInp').value.trim();
  if(!token){setSt('Please enter a GitHub PAT.','err');return}
  if(!org||!pref){setSt('Please fill in organisation and repo prefix.','err');return}
  const btn=$('scanBtn');btn.disabled=true;$('scanLbl').innerHTML='<span class="spin"></span>&nbsp;Scanning…';
  setSt(`Discovering <strong>${esc(pref)}*</strong> repos in <strong>${esc(org)}</strong>…`,'loading');
  $('tbOrg').innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg> ${esc(org)}`;
  $('tbRepos').style.display='none';$('tbPRs').style.display='none';ALL=[];REPOS_META=[];
  try{
    let repos=[];
    try{repos=await ghPages(`https://api.github.com/orgs/${org}/repos?type=all`,token)}
    catch{repos=await ghPages(`https://api.github.com/users/${org}/repos`,token)}
    repos=repos.filter(r=>r.name.toLowerCase().startsWith(pref.toLowerCase()));
    if(!repos.length){setSt(`No repos found starting with <strong>${esc(pref)}</strong> in <strong>${esc(org)}</strong>.`,'err');btn.disabled=false;$('scanLbl').innerHTML='Connect &amp; Scan';return}
    REPOS_META=repos.map(r=>({name:r.name,full_name:r.full_name,description:r.description||'',language:r.language||'',default_branch:r.default_branch||'',visibility:r.private?'Private':'Public',stars:r.stargazers_count||0,forks:r.forks_count||0,open_issues:r.open_issues_count||0,created_at:r.created_at,updated_at:r.updated_at,pushed_at:r.pushed_at,url:r.html_url,topics:(r.topics||[]).join(', ')}));
    $('tbRepos').style.display='';$('tbRepos').innerHTML=`${repos.length} repos`;
    setSt(`Found <strong>${repos.length} repos</strong> — fetching PRs labelled <strong>"${esc(label)}"</strong>…`,'loading');
    for(let i=0;i<repos.length;i++){
      setProg(i+1,repos.length,`${repos[i].name}  (${i+1} / ${repos.length})`);
      const prs=await ghPages(`https://api.github.com/repos/${repos[i].full_name}/pulls?state=all`,token);
      prs.filter(pr=>pr.labels?.some(l=>l.name.toLowerCase()===label.toLowerCase())).forEach(pr=>ALL.push({...pr,_repo:repos[i].name,_full:repos[i].full_name}));
    }
    setTimeout(()=>setProg(0,0),400);
    $('tbPRs').style.display='';$('tbPRs').innerHTML=`${ALL.length} PRs`;
    setSt(`<strong>${ALL.length}</strong> PRs labelled <strong>"${esc(label)}"</strong> across <strong>${repos.length}</strong> repos`,'ok');
    PAGE=1;renderDash(repos,label);
    toast(`✓ Loaded ${ALL.length} PRs from ${repos.length} repos`);
  }catch(e){setSt(`Error: ${esc(e.message)}`,'err');setProg(0,0)}
  finally{btn.disabled=false;$('scanLbl').innerHTML='↺ Refresh'}
}

function toggleTok(){const i=$('tokInput'),s=$('eyeSvg'),show=i.type==='password';i.type=show?'text':'password';s.innerHTML=show?'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>':'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'}

/* ── Excel helpers ── */
const ICON_XLS=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
function xlsxHdr(ws,headers){headers.forEach((h,c)=>{const cell=XLSX.utils.encode_cell({r:0,c});ws[cell]={v:h,t:'s',s:{font:{bold:true,color:{rgb:'FFFFFF'},sz:10},fill:{fgColor:{rgb:'1254A0'}},alignment:{horizontal:'center',vertical:'center',wrapText:true}}}})}
function autoWidth(ws,data,headers){ws['!cols']=headers.map((h,i)=>{const max=data.reduce((m,r)=>Math.max(m,String(r[i]??'').length),String(h).length);return{wch:Math.min(Math.max(max+2,10),60)}})}
function freezeRow(ws){ws['!freeze']={xSplit:0,ySplit:1,topLeftCell:'A2',activePane:'bottomLeft'}}
function addFilter(ws,n){ws['!autofilter']={ref:`A1:${XLSX.utils.encode_col(n-1)}1`}}

function exportRepos(){
  if(!REPOS_META.length){toast('⚠ No repo data — please scan first');return}
  const headers=['Repository Name','Full Name','Description','Language','Default Branch','Visibility','Stars','Forks','Open Issues','Topics','Created','Last Updated','Last Push','GitHub URL'];
  const rows=REPOS_META.map(r=>[r.name,r.full_name,r.description,r.language,r.default_branch,r.visibility,r.stars,r.forks,r.open_issues,r.topics,fmtDate(r.created_at),fmtDate(r.updated_at),fmtDate(r.pushed_at),r.url]);
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet([headers,...rows]);xlsxHdr(ws,headers);autoWidth(ws,rows,headers);freezeRow(ws);addFilter(ws,headers.length);
  XLSX.utils.book_append_sheet(wb,ws,'Repositories');
  const langs={};REPOS_META.forEach(r=>{const l=r.language||'Unknown';langs[l]=(langs[l]||0)+1});
  const sh=['Metric','Value'];const sr=[['Organisation',$('orgInp').value.trim()],['Total Repos',REPOS_META.length],['Report Generated',new Date().toLocaleString()],...Object.entries(langs).sort((a,b)=>b[1]-a[1]).map(([l,n])=>[l,n])];
  const ws2=XLSX.utils.aoa_to_sheet([sh,...sr]);xlsxHdr(ws2,sh);ws2['!cols']=[{wch:30},{wch:25}];freezeRow(ws2);
  XLSX.utils.book_append_sheet(wb,ws2,'Summary');
  XLSX.writeFile(wb,`TaxCaddy_Repos_${new Date().toISOString().slice(0,10)}.xlsx`);toast(`✓ Exported ${REPOS_META.length} repos`);
}
function exportContributors(){
  if(!ALL.length){toast('⚠ No PR data');return}
  const byU={};ALL.forEach(pr=>{const u=pr.user.login;if(!byU[u])byU[u]={login:u,profile:`https://github.com/${u}`,total:0,open:0,merged:0,closed:0,repos:new Set()};const s=stOf(pr);byU[u].total++;byU[u][s]=(byU[u][s]||0)+1;byU[u].repos.add(pr._repo)});
  const users=Object.values(byU).sort((a,b)=>b.total-a.total);
  const headers=['Rank','GitHub Username','Profile URL','Total PRs','Open','Merged','Closed','Repos Contributed','Repositories'];
  const rows=users.map((u,i)=>[i+1,u.login,u.profile,u.total,u.open||0,u.merged||0,u.closed||0,u.repos.size,[...u.repos].join(', ')]);
  const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet([headers,...rows]);xlsxHdr(ws,headers);autoWidth(ws,rows,headers);freezeRow(ws);addFilter(ws,headers.length);
  XLSX.utils.book_append_sheet(wb,ws,'Contributors');XLSX.writeFile(wb,`TaxCaddy_Contributors_${new Date().toISOString().slice(0,10)}.xlsx`);toast(`✓ Exported ${users.length} contributors`);
}
function exportAllPRs(){if(!ALL.length){toast('⚠ No PR data');return}exportPRData(ALL,'All_PRs')}
function exportFilteredPRs(){if(!FILT.length){toast('⚠ No PRs in current filter');return}exportPRData(FILT,'Filtered_PRs')}
function exportPRData(data,label){
  const headers=['PR Number','Title','Repository','Author','State','Created','Updated','Merged At','Branch (from)','Branch (into)','Labels','PR URL'];
  const rows=data.map(pr=>[pr.number,pr.title,pr._repo,pr.user.login,stOf(pr),fmtDate(pr.created_at),fmtDate(pr.updated_at),fmtDate(pr.pull_request?.merged_at||pr.merged_at||null),pr.head?.ref||'',pr.base?.ref||'',(pr.labels||[]).map(l=>l.name).join(', '),pr.html_url]);
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet([headers,...rows]);xlsxHdr(ws,headers);autoWidth(ws,rows,headers);freezeRow(ws);addFilter(ws,headers.length);XLSX.utils.book_append_sheet(wb,ws,'Pull Requests');
  const byR={};data.forEach(pr=>{if(!byR[pr._repo])byR[pr._repo]={repo:pr._repo,total:0,open:0,merged:0,closed:0,authors:new Set()};const s=stOf(pr);byR[pr._repo].total++;byR[pr._repo][s]=(byR[pr._repo][s]||0)+1;byR[pr._repo].authors.add(pr.user.login)});
  const rh=['Repository','Total PRs','Open','Merged','Closed','Unique Authors'];const rr=Object.values(byR).sort((a,b)=>b.total-a.total).map(r=>[r.repo,r.total,r.open||0,r.merged||0,r.closed||0,r.authors.size]);
  const ws2=XLSX.utils.aoa_to_sheet([rh,...rr]);xlsxHdr(ws2,rh);autoWidth(ws2,rr,rh);freezeRow(ws2);addFilter(ws2,rh.length);XLSX.utils.book_append_sheet(wb,ws2,'By Repository');
  const byA={};data.forEach(pr=>{const u=pr.user.login;if(!byA[u])byA[u]={author:u,total:0,open:0,merged:0,closed:0,repos:new Set()};const s=stOf(pr);byA[u].total++;byA[u][s]=(byA[u][s]||0)+1;byA[u].repos.add(pr._repo)});
  const ah=['Author','Total PRs','Open','Merged','Closed','Repos Contributed'];const ar=Object.values(byA).sort((a,b)=>b.total-a.total).map(a=>[a.author,a.total,a.open||0,a.merged||0,a.closed||0,a.repos.size]);
  const ws3=XLSX.utils.aoa_to_sheet([ah,...ar]);xlsxHdr(ws3,ah);autoWidth(ws3,ar,ah);freezeRow(ws3);addFilter(ws3,ah.length);XLSX.utils.book_append_sheet(wb,ws3,'By Author');
  XLSX.writeFile(wb,`TaxCaddy_${label}_${new Date().toISOString().slice(0,10)}.xlsx`);toast(`✓ Exported ${data.length} PRs`);
}

function toggleMenu(id){document.querySelectorAll('.exp-menu').forEach(m=>{if(m.id!==id)m.classList.remove('open')});$(id).classList.toggle('open')}
document.addEventListener('click',e=>{if(!e.target.closest('.exp-wrap'))document.querySelectorAll('.exp-menu').forEach(m=>m.classList.remove('open'))});

function renderDash(repos,label){
  const open=ALL.filter(p=>stOf(p)==='open').length,merged=ALL.filter(p=>stOf(p)==='merged').length;
  const byU={};ALL.forEach(pr=>{const u=pr.user.login;if(!byU[u])byU[u]={login:u,av:pr.user.avatar_url,n:0,repos:new Set()};byU[u].n++;byU[u].repos.add(pr._repo)});
  const users=Object.values(byU).sort((a,b)=>b.n-a.n);
  const byR={};ALL.forEach(pr=>{if(!byR[pr._repo])byR[pr._repo]={name:pr._repo,full:pr._full,n:0};byR[pr._repo].n++});
  const rlist=Object.values(byR).sort((a,b)=>b.n-a.n);
  const uOpts=users.map(u=>`<option value="${esc(u.login)}">${esc(u.login)} (${u.n})</option>`).join('');
  const rOpts=rlist.map(r=>`<option value="${esc(r.name)}">${esc(r.name)} (${r.n})</option>`).join('');
  const Rico=`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/></svg>`;
  $('dash').innerHTML=`
  <div class="metrics">
    <div class="mc"><div class="mc-lbl">Repos scanned</div><div class="mc-val" style="color:var(--blue)">${repos.length}</div><div class="mc-sub">prefix: ${esc($('prefInp').value.trim())}</div></div>
    <div class="mc"><div class="mc-lbl">Total PRs</div><div class="mc-val">${ALL.length}</div><div class="mc-sub">label: "${esc(label)}"</div></div>
    <div class="mc"><div class="mc-lbl">Open</div><div class="mc-val" style="color:var(--green)">${open}</div><div class="mc-sub">awaiting review</div></div>
    <div class="mc"><div class="mc-lbl">Merged</div><div class="mc-val" style="color:var(--purple)">${merged}</div><div class="mc-sub">shipped</div></div>
    <div class="mc"><div class="mc-lbl">Authors</div><div class="mc-val">${users.length}</div><div class="mc-sub">unique contributors</div></div>
  </div>
  <div class="sec-hd-row">
    <div class="sec-hd"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/></svg>Services with AI-generated PRs</div>
    <div class="exp-wrap"><button class="btn btn-export" onclick="toggleMenu('menuRepos')">${ICON_XLS} Export Services <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
    <div class="exp-menu" id="menuRepos"><div class="exp-menu-label">Export options</div>
    <button class="exp-menu-item" onclick="exportRepos();toggleMenu('menuRepos')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>All ${REPOS_META.length} Repos — Full Details<span style="font-size:10px;color:var(--txt3);margin-left:auto">2 sheets</span></button></div></div>
  </div>
  <div class="chips">${rlist.map(r=>`<div class="chip">${Rico}${esc(r.name)}<span class="cn">${r.n}</span></div>`).join('')}</div>
  <div class="sec-hd-row">
    <div class="sec-hd"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Contributors</div>
    <div class="exp-wrap"><button class="btn btn-export" onclick="toggleMenu('menuContrib')">${ICON_XLS} Export Contributors <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
    <div class="exp-menu" id="menuContrib"><div class="exp-menu-label">Export options</div>
    <button class="exp-menu-item" onclick="exportContributors();toggleMenu('menuContrib')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>Contributors Summary<span style="font-size:10px;color:var(--txt3);margin-left:auto">1 sheet</span></button>
    <div class="exp-menu-sep"></div>
    <button class="exp-menu-item" onclick="exportAllPRs();toggleMenu('menuContrib')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/></svg>All ${ALL.length} PRs — Full Detail<span style="font-size:10px;color:var(--txt3);margin-left:auto">3 sheets</span></button></div></div>
  </div>
  <div class="ugrid">${users.map(u=>`<div class="uc"><div class="av">${u.av?`<img src="${esc(u.av)}" alt="${esc(u.login)}" loading="lazy"/>`:ini(u.login)}</div><div style="flex:1;min-width:0"><div class="un">${esc(u.login)}</div><div class="um"><span class="pill p-purple">${u.n} PR${u.n!==1?'s':''}</span><span style="color:var(--txt3)">${u.repos.size} repo${u.repos.size!==1?'s':''}</span></div></div></div>`).join('')}</div>
  <div class="tcard">
    <div class="ttbar">
      <span class="ttitle">Pull Requests <span class="tcnt" id="cntEl">${ALL.length} results</span></span>
      <input class="sinp" id="qInp" placeholder="Search…" oninput="refilter()"/>
      <select class="fsel" id="rFil" onchange="refilter()"><option value="all">All services</option>${rOpts}</select>
      <select class="fsel" id="sFil" onchange="refilter()"><option value="all">All states</option><option value="open">Open</option><option value="merged">Merged</option><option value="closed">Closed</option></select>
      <select class="fsel" id="uFil" onchange="refilter()"><option value="all">All authors</option>${uOpts}</select>
      <div class="exp-wrap"><button class="btn btn-export" onclick="toggleMenu('menuPRs')">${ICON_XLS} Export PRs <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
      <div class="exp-menu" id="menuPRs"><div class="exp-menu-label">Export options</div>
      <button class="exp-menu-item" onclick="exportAllPRs();toggleMenu('menuPRs')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/></svg>All ${ALL.length} PRs (unfiltered)<span style="font-size:10px;color:var(--txt3);margin-left:auto">3 sheets</span></button>
      <button class="exp-menu-item" onclick="exportFilteredPRs();toggleMenu('menuPRs')" id="filteredExpBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>Current filtered view<span style="font-size:10px;color:var(--txt3);margin-left:auto" id="filteredCntExp">${ALL.length} PRs · 3 sheets</span></button>
      <div class="exp-menu-sep"></div>
      <button class="exp-menu-item" onclick="exportContributors();toggleMenu('menuPRs')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>Contributors summary<span style="font-size:10px;color:var(--txt3);margin-left:auto">1 sheet</span></button>
      <button class="exp-menu-item" onclick="exportRepos();toggleMenu('menuPRs')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>All repos — full details<span style="font-size:10px;color:var(--txt3);margin-left:auto">2 sheets</span></button></div></div>
    </div>
    <div class="tcols thead-row" style="padding:9px 18px;background:var(--surf2);border-bottom:0.5px solid var(--bdr);font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--txt3)">
      <span>PR #</span><span>Title &amp; Service</span><span>Author</span><span>Repository</span><span>State</span><span>Opened</span><span>Updated</span>
    </div>
    <div id="tbody"></div>
    <div class="tpag" id="tpag"></div>
  </div>`;
  refilter();
}
function refilter(){
  PAGE=1;
  const s=$('sFil')?.value||'all',u=$('uFil')?.value||'all',r=$('rFil')?.value||'all',q=($('qInp')?.value||'').toLowerCase();
  FILT=ALL.filter(pr=>{if(s!=='all'&&stOf(pr)!==s)return false;if(u!=='all'&&pr.user.login!==u)return false;if(r!=='all'&&pr._repo!==r)return false;if(q&&!pr.title.toLowerCase().includes(q)&&!pr.user.login.toLowerCase().includes(q)&&!pr._repo.toLowerCase().includes(q))return false;return true});
  const cnt=$('cntEl');if(cnt)cnt.textContent=`${FILT.length} result${FILT.length!==1?'s':''}`;
  const fce=$('filteredCntExp');if(fce)fce.textContent=`${FILT.length} PRs · 3 sheets`;
  renderRows();
}
function renderRows(){
  const tot=Math.max(1,Math.ceil(FILT.length/PG));if(PAGE>tot)PAGE=tot;
  const slice=FILT.slice((PAGE-1)*PG,PAGE*PG);
  const SC={open:'p-green',closed:'p-red',merged:'p-purple'};const SL={open:'Open',closed:'Closed',merged:'Merged'};
  $('tbody').innerHTML=slice.map(pr=>{const s=stOf(pr);const av=pr.user.avatar_url?`<img src="${esc(pr.user.avatar_url)}" alt="${esc(pr.user.login)}" loading="lazy" style="width:20px;height:20px;border-radius:50%;flex-shrink:0">`:`<div class="ainit" style="flex-shrink:0">${ini(pr.user.login)}</div>`;return `<div class="tr tcols"><div class="prnum"><a href="${esc(pr.html_url)}" target="_blank" rel="noopener">#${pr.number}</a></div><div style="min-width:0"><div class="prtitle" title="${esc(pr.title)}">${esc(pr.title)}</div></div><div class="prauth">${av}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px">${esc(pr.user.login)}</span></div><div class="prrepo">${esc(pr._repo)}</div><div><span class="pill ${SC[s]}">${SL[s]}</span></div><div class="prdate">${ago(pr.created_at)}</div><div class="prdate">${ago(pr.updated_at)}</div></div>`}).join('')||`<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><p>No PRs match the current filters</p></div>`;
  $('tpag').innerHTML=`<span>Page ${PAGE} of ${tot} · ${FILT.length} result${FILT.length!==1?'s':''}</span><div style="display:flex;gap:8px"><button class="btn" style="height:30px;font-size:12px;padding:0 13px" onclick="chPg(-1)" ${PAGE<=1?'disabled':''}>← Prev</button><button class="btn" style="height:30px;font-size:12px;padding:0 13px" onclick="chPg(1)" ${PAGE>=tot?'disabled':''}>Next →</button></div>`;
}
function chPg(d){const tot=Math.max(1,Math.ceil(FILT.length/PG));PAGE=Math.max(1,Math.min(tot,PAGE+d));renderRows()}

/* ═══════════════════════════════════════════════
   AZURE DEVOPS SPRINT TAB
═══════════════════════════════════════════════ */
let ADO_ITEMS=[], ADO_FILT=[], ADO_PAGE=1, ADO_SPRINT_INFO=null;
const ADO_PG=30;

function toggleAdoTok(){const i=$('adoTok'),s=$('adoEyeSvg'),show=i.type==='password';i.type=show?'text':'password';s.innerHTML=show?'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>':'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'}

function adoHeaders(token){
  const b64=btoa(':'+token);
  return{Authorization:`Basic ${b64}`,'Content-Type':'application/json'};
}

async function adoFetch(url,token){
  const r=await fetch(url,{headers:adoHeaders(token)});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.message||`HTTP ${r.status} — ${url}`)}
  return r.json();
}

/* ── Step 1: fetch sprint list and populate dropdown ── */
let ADO_ALL_SPRINTS=[];

async function adoFetchSprints(){
  const token=$('adoTok').value.trim();
  const org=$('adoOrg').value.trim();
  const project=$('adoProject').value.trim();
  const team=$('adoTeam').value.trim();
  if(!token){mkSt('adoStatus','Please enter an ADO PAT.','err');return}
  if(!org||!project||!team){mkSt('adoStatus','Please fill in Org, Project, and Team.','err');return}
  const btn=$('adoConnectBtn');btn.disabled=true;$('adoConnectLbl').innerHTML='<span class="spin"></span>&nbsp;Connecting…';
  mkSt('adoStatus','Fetching sprint list from Azure DevOps…','loading');
  try{
    const base=`https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}`;
    const sprintsUrl=`${base}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations?api-version=7.1`;
    const sprintsData=await adoFetch(sprintsUrl,token);
    ADO_ALL_SPRINTS=sprintsData.value||[];
    if(!ADO_ALL_SPRINTS.length){mkSt('adoStatus','No sprints found. Check team name and project.','err');return}

    /* Build dropdown — group by timeFrame */
    const current=ADO_ALL_SPRINTS.filter(s=>s.attributes?.timeFrame==='current');
    const past=[...ADO_ALL_SPRINTS.filter(s=>s.attributes?.timeFrame==='past')].reverse(); // most recent first
    const future=ADO_ALL_SPRINTS.filter(s=>s.attributes?.timeFrame==='future');
    const sel=$('adoSprintSel');
    sel.innerHTML='';
    const addGroup=(label,items)=>{
      if(!items.length)return;
      const grp=document.createElement('optgroup');grp.label=label;
      items.forEach(s=>{
        const o=document.createElement('option');
        o.value=s.id;
        const sd=s.attributes?.startDate?new Date(s.attributes.startDate).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
        const ed=s.attributes?.finishDate?new Date(s.attributes.finishDate).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
        o.textContent=`${s.name}${sd&&ed?' ('+sd+' – '+ed+')':''}`;
        if(s.attributes?.timeFrame==='current')o.textContent+=' ★ Current';
        grp.appendChild(o);
      });
      sel.appendChild(grp);
    };
    addGroup('▶ Current Sprint',current);
    addGroup('⏮ Past Sprints',past);
    addGroup('⏭ Future Sprints',future);

    /* Auto-select current sprint */
    const cur=current[0]||ADO_ALL_SPRINTS[0];
    if(cur)sel.value=cur.id;

    $('adoSprintRow').style.display='';
    mkSt('adoStatus',`Found <strong>${ADO_ALL_SPRINTS.length} sprints</strong>. Current sprint pre-selected — or pick another, then click <strong>Load Sprint</strong>.`,'ok');
    $('adoConnectLbl').innerHTML='↺ Refresh';
  }catch(e){mkSt('adoStatus',`Error: ${esc(e.message)}`,'err')}
  finally{btn.disabled=false}
}

/* ── Step 2: load work items for selected sprint ── */
async function adoConnect(){
  const token=$('adoTok').value.trim();
  const org=$('adoOrg').value.trim();
  const project=$('adoProject').value.trim();
  const team=$('adoTeam').value.trim();
  const sprintId=$('adoSprintSel').value;

  if(!token){mkSt('adoStatus','Please enter an ADO PAT.','err');return}
  if(!sprintId){mkSt('adoStatus','Please select a sprint from the dropdown.','err');return}

  const sprint=ADO_ALL_SPRINTS.find(s=>s.id===sprintId);
  if(!sprint){mkSt('adoStatus','Sprint not found — please click Connect again.','err');return}

  const btn=$('adoScanBtn');btn.disabled=true;$('adoScanLbl').innerHTML='<span class="spin"></span>&nbsp;Loading…';
  mkSt('adoStatus',`Loading work items for <strong>${esc(sprint.name)}</strong>…`,'loading');
  ADO_ITEMS=[];ADO_SPRINT_INFO=null;

  try{
    const base=`https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}`;

    ADO_SPRINT_INFO={
      name:sprint.name,id:sprint.id,
      startDate:sprint.attributes?.startDate,
      endDate:sprint.attributes?.finishDate,
      timeFrame:sprint.attributes?.timeFrame||'unknown',
      url:sprint.url
    };

    $('tbSprint').style.display='';$('tbSprint').innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${esc(sprint.name)}`;

    /* 1. Get work item IDs in this sprint */
    const wiUrl=`${base}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations/${sprint.id}/workitems?api-version=7.1`;
    const wiData=await adoFetch(wiUrl,token);
    const wiIds=(wiData.workItemRelations||[]).map(r=>r.target?.id).filter(Boolean);

    if(!wiIds.length){
      mkSt('adoStatus',`Sprint <strong>${esc(sprint.name)}</strong> has no work items.`,'ok');
      renderAdoDash([],sprint);
      return;
    }

    mkSt('adoStatus',`Fetching details for <strong>${wiIds.length}</strong> work items…`,'loading');

    /* 3. Batch-fetch work item details (max 200 per call) */
    const fields=['System.Id','System.Title','System.WorkItemType','System.State','System.AssignedTo','System.AreaPath','Microsoft.VSTS.Scheduling.RemainingWork','Microsoft.VSTS.Scheduling.StoryPoints','Microsoft.VSTS.Scheduling.OriginalEstimate','System.CreatedDate','System.ChangedDate','System.Parent','System.Tags','System.IterationPath','System.Description'].join(',');
    const allItems=[];
    for(let i=0;i<wiIds.length;i+=200){
      const batch=wiIds.slice(i,i+200);
      const detailUrl=`https://dev.azure.com/${encodeURIComponent(org)}/_apis/wit/workitems?ids=${batch.join(',')}&fields=${fields}&api-version=7.1`;
      const detailData=await adoFetch(detailUrl,token);
      allItems.push(...(detailData.value||[]));
    }
    ADO_ITEMS=allItems.map(wi=>({
      id:wi.id,
      title:wi.fields['System.Title']||'',
      type:wi.fields['System.WorkItemType']||'',
      state:wi.fields['System.State']||'',
      assignedTo:wi.fields['System.AssignedTo']?.displayName||wi.fields['System.AssignedTo']||'Unassigned',
      areaPath:wi.fields['System.AreaPath']||'',
      remaining:wi.fields['Microsoft.VSTS.Scheduling.RemainingWork']||0,
      storyPoints:wi.fields['Microsoft.VSTS.Scheduling.StoryPoints']||0,
      originalEst:wi.fields['Microsoft.VSTS.Scheduling.OriginalEstimate']||0,
      createdDate:wi.fields['System.CreatedDate']||'',
      changedDate:wi.fields['System.ChangedDate']||'',
      parent:wi.fields['System.Parent']||null,
      tags:wi.fields['System.Tags']||'',
      iterationPath:wi.fields['System.IterationPath']||'',
      url:`https://dev.azure.com/${org}/${project}/_workitems/edit/${wi.id}`
    }));

    mkSt('adoStatus',`<strong>${ADO_ITEMS.length}</strong> work items loaded for sprint <strong>${esc(sprint.name)}</strong>`,'ok');
    ADO_PAGE=1;renderAdoDash(ADO_ITEMS,sprint);
    toast(`✓ Sprint loaded: ${ADO_ITEMS.length} items`);
  }catch(e){
    mkSt('adoStatus',`Error: ${esc(e.message)}`,'err');
    console.error(e);
  }finally{
    btn.disabled=false;$('adoScanLbl').innerHTML='↺ Refresh';
  }
}

/* ── ADO state/type styling ── */
function stateClass(s){const m={'Active':'st-active','In Progress':'st-active','New':'st-new','Ready':'st-new','Resolved':'st-resolved','Closed':'st-closed','Done':'st-closed','Removed':'st-removed'};return m[s]||'st-new'}
function typeClass(t){const m={'Bug':'wi-bug','Task':'wi-task','User Story':'wi-story','Feature':'wi-feature','Epic':'wi-epic'};return m[t]||'wi-task'}
function typeIcon(t){
  const icons={
    'Bug':'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    'Task':'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    'User Story':'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    'Feature':'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    'Epic':'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m13 2-2 2.5h3L12 7"/><path d="M10 14v-3"/><path d="M14 14v-3"/><path d="M11 19c-1.7 0-3-1.3-3-3v-2h8v2c0 1.7-1.3 3-3 3z"/><path d="M12 22v-3"/></svg>'
  };
  return icons[t]||icons['Task'];
}
function daysLeft(endDate){
  if(!endDate)return null;
  const d=Math.ceil((new Date(endDate)-new Date())/(1000*60*60*24));
  return d;
}

/* ── Render ADO Dashboard ── */
function renderAdoDash(items,sprint){
  const total=items.length;
  const byState={};items.forEach(i=>{byState[i.state]=(byState[i.state]||0)+1});
  const active=(byState['Active']||0)+(byState['In Progress']||0);
  const newItems=(byState['New']||0)+(byState['Ready']||0);
  const resolved=(byState['Resolved']||0);
  const closed=(byState['Closed']||0)+(byState['Done']||0);
  const totalSP=items.reduce((s,i)=>s+(i.storyPoints||0),0);
  const totalRem=items.reduce((s,i)=>s+(i.remaining||0),0);
  const dl=daysLeft(sprint.endDate);
  const dlTxt=dl===null?'—':dl<0?`${Math.abs(dl)}d overdue`:dl===0?'Ends today':`${dl}d left`;
  const dlColor=dl===null?'var(--txt3)':dl<0?'var(--red)':dl<=3?'var(--amber)':'var(--green)';

  /* By member */
  const byMember={};
  items.forEach(i=>{
    const m=i.assignedTo||'Unassigned';
    if(!byMember[m])byMember[m]={name:m,total:0,active:0,new:0,resolved:0,closed:0,sp:0,rem:0};
    byMember[m].total++;
    const sl=i.state.toLowerCase();
    if(sl==='active'||sl==='in progress')byMember[m].active++;
    else if(sl==='new'||sl==='ready')byMember[m].new++;
    else if(sl==='resolved')byMember[m].resolved++;
    else if(sl==='closed'||sl==='done')byMember[m].closed++;
    byMember[m].sp+=i.storyPoints||0;
    byMember[m].rem+=i.remaining||0;
  });
  const members=Object.values(byMember).sort((a,b)=>b.total-a.total);

  /* Filter options */
  const stateOpts=[...new Set(items.map(i=>i.state))].sort().map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  const memberOpts=members.map(m=>`<option value="${esc(m.name)}">${esc(m.name)} (${m.total})</option>`).join('');
  const typeOpts=[...new Set(items.map(i=>i.type))].sort().map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');

  $('adoDash').innerHTML=`
  <!-- Sprint Banner -->
  <div class="sprint-banner">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
    <div>
      <div class="sprint-name">${esc(sprint.name)}</div>
      <div class="sprint-dates">${fmtShort(sprint.startDate)} — ${fmtShort(sprint.endDate)} &nbsp;·&nbsp; ${esc($('adoOrg').value.trim())} / ${esc($('adoProject').value.trim())} / ${esc($('adoTeam').value.trim())}</div>
    </div>
    <span class="sprint-days" style="color:${dlColor};background:${dl!==null&&dl<0?'var(--redbg)':dl!==null&&dl<=3?'var(--amberbg)':'var(--greenbg)'}">${dlTxt}</span>
    <div style="flex:1"></div>
    <div class="exp-wrap">
      <button class="btn btn-export" onclick="toggleMenu('menuAdo')">${ICON_XLS} Export Sprint <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
      <div class="exp-menu" id="menuAdo">
        <div class="exp-menu-label">Export options</div>
        <button class="exp-menu-item" onclick="exportAdoAll();toggleMenu('menuAdo')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>All Work Items — Full Detail<span style="font-size:10px;color:var(--txt3);margin-left:auto">3 sheets</span></button>
        <button class="exp-menu-item" onclick="exportAdoFiltered();toggleMenu('menuAdo')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>Current filtered view<span style="font-size:10px;color:var(--txt3);margin-left:auto" id="adoFiltExp">${items.length} items · 3 sheets</span></button>
        <div class="exp-menu-sep"></div>
        <button class="exp-menu-item" onclick="exportAdoByMember();toggleMenu('menuAdo')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>Team Member Summary<span style="font-size:10px;color:var(--txt3);margin-left:auto">1 sheet</span></button>
      </div>
    </div>
    <button class="btn" style="height:34px;font-size:12px" onclick="adoConnect()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg> Reload Items</button>
    <button class="btn" style="height:34px;font-size:12px" onclick="adoFetchSprints()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg> Change Sprint</button>
  </div>

  <!-- Metrics -->
  <div class="metrics6">
    <div class="mc"><div class="mc-lbl">Total Items</div><div class="mc-val">${total}</div><div class="mc-sub">in sprint</div></div>
    <div class="mc"><div class="mc-lbl">Active</div><div class="mc-val" style="color:var(--green)">${active}</div><div class="mc-sub">in progress</div></div>
    <div class="mc"><div class="mc-lbl">New / Ready</div><div class="mc-val" style="color:var(--blue)">${newItems}</div><div class="mc-sub">not started</div></div>
    <div class="mc"><div class="mc-lbl">Resolved</div><div class="mc-val" style="color:var(--purple)">${resolved}</div><div class="mc-sub">awaiting verify</div></div>
    <div class="mc"><div class="mc-lbl">Closed / Done</div><div class="mc-val" style="color:var(--txt2)">${closed}</div><div class="mc-sub">completed</div></div>
    <div class="mc"><div class="mc-lbl">Story Points</div><div class="mc-val" style="color:var(--teal)">${totalSP}</div><div class="mc-sub">${totalRem}h remaining</div></div>
  </div>

  <!-- Team Member Cards -->
  <div class="sec-hd"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Team Members</div>
  <div class="member-grid">
    ${members.map(m=>`<div class="mcard" onclick="filterByMember('${esc(m.name)}')" title="Click to filter items for ${esc(m.name)}">
      <div class="mcard-name">${esc(m.name)}</div>
      <div class="mcard-stats">
        <div class="mstat"><div class="mstat-val" style="color:var(--green)">${m.active}</div><div class="mstat-lbl">Active</div></div>
        <div class="mstat"><div class="mstat-val" style="color:var(--blue)">${m.new}</div><div class="mstat-lbl">New</div></div>
        <div class="mstat"><div class="mstat-val" style="color:var(--purple)">${m.resolved}</div><div class="mstat-lbl">Resolved</div></div>
        <div class="mstat"><div class="mstat-val" style="color:var(--txt2)">${m.closed}</div><div class="mstat-lbl">Closed</div></div>
        ${m.sp?`<div class="mstat"><div class="mstat-val" style="color:var(--teal)">${m.sp}</div><div class="mstat-lbl">SP</div></div>`:''}
        ${m.rem?`<div class="mstat"><div class="mstat-val" style="color:var(--amber)">${m.rem}h</div><div class="mstat-lbl">Rem</div></div>`:''}
      </div>
    </div>`).join('')}
  </div>

  <!-- Work Items Table -->
  <div class="tcard">
    <div class="ttbar">
      <span class="ttitle">Work Items <span class="tcnt" id="adoCntEl">${total} items</span></span>
      <input class="sinp" id="adoQInp" placeholder="Search title / assigned…" oninput="adoRefilter()"/>
      <select class="fsel" id="adoTypeFil" onchange="adoRefilter()"><option value="all">All types</option>${typeOpts}</select>
      <select class="fsel" id="adoStateFil" onchange="adoRefilter()"><option value="all">All states</option>${stateOpts}</select>
      <select class="fsel" id="adoMemberFil" onchange="adoRefilter()"><option value="all">All members</option>${memberOpts}</select>
    </div>
    <div class="ado-cols thead-row" style="padding:9px 18px;background:var(--surf2);border-bottom:0.5px solid var(--bdr);font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--txt3)">
      <span>ID</span><span>Title</span><span>State</span><span>Assigned To</span><span>Type</span><span>Story Pts</span><span>Remaining</span>
    </div>
    <div id="adoTbody"></div>
    <div class="tpag" id="adoTpag"></div>
  </div>`;

  adoRefilter();
}

function filterByMember(name){
  const sel=$('adoMemberFil');if(sel){sel.value=name;adoRefilter()}
  // scroll to table
  document.getElementById('adoTbody')?.scrollIntoView({behavior:'smooth',block:'start'});
}

function adoRefilter(){
  ADO_PAGE=1;
  const state=$('adoStateFil')?.value||'all';
  const member=$('adoMemberFil')?.value||'all';
  const type=$('adoTypeFil')?.value||'all';
  const q=($('adoQInp')?.value||'').toLowerCase();
  ADO_FILT=ADO_ITEMS.filter(i=>{
    if(state!=='all'&&i.state!==state)return false;
    if(member!=='all'&&i.assignedTo!==member)return false;
    if(type!=='all'&&i.type!==type)return false;
    if(q&&!i.title.toLowerCase().includes(q)&&!i.assignedTo.toLowerCase().includes(q))return false;
    return true;
  });
  const cnt=$('adoCntEl');if(cnt)cnt.textContent=`${ADO_FILT.length} item${ADO_FILT.length!==1?'s':''}`;
  const fce=$('adoFiltExp');if(fce)fce.textContent=`${ADO_FILT.length} items · 3 sheets`;
  adoRenderRows();
}

function adoRenderRows(){
  const tot=Math.max(1,Math.ceil(ADO_FILT.length/ADO_PG));
  if(ADO_PAGE>tot)ADO_PAGE=tot;
  const slice=ADO_FILT.slice((ADO_PAGE-1)*ADO_PG,ADO_PAGE*ADO_PG);
  $('adoTbody').innerHTML=slice.map(i=>`
    <div class="tr ado-cols">
      <div><a href="${esc(i.url)}" target="_blank" rel="noopener" style="color:var(--blue);font-weight:700;font-size:11px;font-family:monospace">${i.id}</a></div>
      <div style="min-width:0">
        <div class="prtitle" title="${esc(i.title)}">${esc(i.title)}</div>
        ${i.tags?`<div style="font-size:10px;color:var(--txt3);margin-top:1px">${esc(i.tags)}</div>`:''}
      </div>
      <div><span class="pill ${stateClass(i.state)}" style="font-size:11px">${esc(i.state)}</span></div>
      <div style="font-size:12px;color:var(--txt2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(i.assignedTo)}</div>
      <div><span class="${typeClass(i.type)}" style="display:flex;align-items:center;gap:4px;font-size:12px">${typeIcon(i.type)}${esc(i.type)}</span></div>
      <div style="font-size:12px;color:var(--teal);font-weight:600">${i.storyPoints||'—'}</div>
      <div style="font-size:12px;color:${i.remaining>0?'var(--amber)':'var(--txt3)'};font-weight:${i.remaining>0?'600':'400'}">${i.remaining?i.remaining+'h':'—'}</div>
    </div>`).join('')||`<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><p>No items match the current filters</p></div>`;
  $('adoTpag').innerHTML=`<span>Page ${ADO_PAGE} of ${tot} · ${ADO_FILT.length} item${ADO_FILT.length!==1?'s':''}</span><div style="display:flex;gap:8px"><button class="btn" style="height:30px;font-size:12px;padding:0 13px" onclick="adoChPg(-1)" ${ADO_PAGE<=1?'disabled':''}>← Prev</button><button class="btn" style="height:30px;font-size:12px;padding:0 13px" onclick="adoChPg(1)" ${ADO_PAGE>=tot?'disabled':''}>Next →</button></div>`;
}
function adoChPg(d){const tot=Math.max(1,Math.ceil(ADO_FILT.length/ADO_PG));ADO_PAGE=Math.max(1,Math.min(tot,ADO_PAGE+d));adoRenderRows()}

/* ── ADO Excel Exports ── */
function adoItemRows(data){
  return data.map(i=>[i.id,i.title,i.type,i.state,i.assignedTo,i.storyPoints||0,i.remaining||0,i.originalEst||0,i.areaPath,i.tags,fmtDate(i.createdDate),fmtDate(i.changedDate),i.url]);
}
function exportAdoAll(){
  if(!ADO_ITEMS.length){toast('⚠ No sprint data');return}
  exportAdoData(ADO_ITEMS,'Sprint_All');
}
function exportAdoFiltered(){
  if(!ADO_FILT.length){toast('⚠ No items in current filter');return}
  exportAdoData(ADO_FILT,'Sprint_Filtered');
}
function exportAdoData(data,label){
  const sn=ADO_SPRINT_INFO?.name||'Sprint';
  const wb=XLSX.utils.book_new();

  /* Sheet 1 — Work Items */
  const headers=['ID','Title','Type','State','Assigned To','Story Points','Remaining (h)','Original Est (h)','Area Path','Tags','Created','Last Changed','ADO URL'];
  const rows=adoItemRows(data);
  const ws=XLSX.utils.aoa_to_sheet([headers,...rows]);xlsxHdr(ws,headers);autoWidth(ws,rows,headers);freezeRow(ws);addFilter(ws,headers.length);
  XLSX.utils.book_append_sheet(wb,ws,'Work Items');

  /* Sheet 2 — By Member */
  const byM={};data.forEach(i=>{const m=i.assignedTo;if(!byM[m])byM[m]={name:m,total:0,active:0,new:0,resolved:0,closed:0,sp:0,rem:0};byM[m].total++;const sl=i.state.toLowerCase();if(sl==='active'||sl==='in progress')byM[m].active++;else if(sl==='new'||sl==='ready')byM[m].new++;else if(sl==='resolved')byM[m].resolved++;else if(sl==='closed'||sl==='done')byM[m].closed++;byM[m].sp+=i.storyPoints||0;byM[m].rem+=i.remaining||0});
  const mh=['Member','Total','Active','New/Ready','Resolved','Closed/Done','Story Points','Remaining (h)'];
  const mr=Object.values(byM).sort((a,b)=>b.total-a.total).map(m=>[m.name,m.total,m.active,m.new,m.resolved,m.closed,m.sp,m.rem]);
  const ws2=XLSX.utils.aoa_to_sheet([mh,...mr]);xlsxHdr(ws2,mh);autoWidth(ws2,mr,mh);freezeRow(ws2);addFilter(ws2,mh.length);
  XLSX.utils.book_append_sheet(wb,ws2,'By Member');

  /* Sheet 3 — Summary */
  const sh=['Metric','Value'];
  const total=data.length;
  const active=data.filter(i=>['active','in progress'].includes(i.state.toLowerCase())).length;
  const newI=data.filter(i=>['new','ready'].includes(i.state.toLowerCase())).length;
  const resolved=data.filter(i=>i.state.toLowerCase()==='resolved').length;
  const closed=data.filter(i=>['closed','done'].includes(i.state.toLowerCase())).length;
  const sr=[
    ['Sprint',sn],['Start Date',fmtDate(ADO_SPRINT_INFO?.startDate)],['End Date',fmtDate(ADO_SPRINT_INFO?.endDate)],
    ['Organisation',$('adoOrg').value.trim()],['Project',$('adoProject').value.trim()],['Team',$('adoTeam').value.trim()],
    [''],['Total Items',total],['Active',active],['New / Ready',newI],['Resolved',resolved],['Closed / Done',closed],
    ['Total Story Points',data.reduce((s,i)=>s+(i.storyPoints||0),0)],
    ['Total Remaining (h)',data.reduce((s,i)=>s+(i.remaining||0),0)],
    ['Report Generated',new Date().toLocaleString()]
  ];
  const ws3=XLSX.utils.aoa_to_sheet([sh,...sr]);xlsxHdr(ws3,sh);ws3['!cols']=[{wch:28},{wch:30}];freezeRow(ws3);
  XLSX.utils.book_append_sheet(wb,ws3,'Summary');

  XLSX.writeFile(wb,`TaxCaddy_${label}_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast(`✓ Exported ${data.length} work items (3 sheets)`);
}
function exportAdoByMember(){
  if(!ADO_ITEMS.length){toast('⚠ No sprint data');return}
  const byM={};ADO_ITEMS.forEach(i=>{const m=i.assignedTo;if(!byM[m])byM[m]={name:m,total:0,active:0,new:0,resolved:0,closed:0,sp:0,rem:0,items:[]};byM[m].total++;const sl=i.state.toLowerCase();if(sl==='active'||sl==='in progress')byM[m].active++;else if(sl==='new'||sl==='ready')byM[m].new++;else if(sl==='resolved')byM[m].resolved++;else if(sl==='closed'||sl==='done')byM[m].closed++;byM[m].sp+=i.storyPoints||0;byM[m].rem+=i.remaining||0;byM[m].items.push(i)});
  const mh=['Member','Total','Active','New/Ready','Resolved','Closed/Done','Story Points','Remaining (h)'];
  const mr=Object.values(byM).sort((a,b)=>b.total-a.total).map(m=>[m.name,m.total,m.active,m.new,m.resolved,m.closed,m.sp,m.rem]);
  const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet([mh,...mr]);xlsxHdr(ws,mh);autoWidth(ws,mr,mh);freezeRow(ws);addFilter(ws,mh.length);
  XLSX.utils.book_append_sheet(wb,ws,'Team Summary');
  XLSX.writeFile(wb,`TaxCaddy_Team_Summary_${new Date().toISOString().slice(0,10)}.xlsx`);toast(`✓ Exported team summary`);
}
