(function(){
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  $$('[data-share]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-share') || document.title;
      const url = btn.getAttribute('data-share-url') || location.href;
      if (navigator.share) {
        try { await navigator.share({ title: document.title, text, url }); return; } catch {}
      }
      try { await navigator.clipboard.writeText(`${text} ${url}`); btn.textContent = 'Copied share text'; setTimeout(()=>btn.textContent='Share finding',1600); } catch {}
    });
  });

  $$('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-copy') || location.href;
      try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; setTimeout(()=>btn.textContent='Copy citation',1600); } catch {}
    });
  });

  const heroForm = $('#hero-issue-form');
  if (heroForm) {
    heroForm.addEventListener('submit', e => {
      e.preventDefault();
      const q = ($('#hero-issue')?.value || '').trim();
      location.href = `/who-handles-this/${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    });
  }

  const issueRoot = $('#issue-resolver');
  if (issueRoot && window.HOT_ISSUES) {
    const issues = window.HOT_ISSUES;
    const list = $('#issue-list', issueRoot);
    const result = $('#issue-result', issueRoot);
    const search = $('#issue-search', issueRoot);
    let activeId = null;

    function score(issue, q) {
      const hay = `${issue.label} ${issue.summary} ${issue.keywords.join(' ')}`.toLowerCase();
      const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
      return tokens.reduce((n,t)=>n+(hay.includes(t)?1:0),0);
    }
    function renderList(items) {
      list.innerHTML = items.map(i=>`<button type="button" data-id="${i.id}" class="${i.id===activeId?'active':''}">${i.label}</button>`).join('');
      $$('button[data-id]', list).forEach(b=>b.addEventListener('click',()=>show(b.dataset.id)));
    }
    function show(id) {
      activeId=id; const i=issues.find(x=>x.id===id); if(!i)return;
      renderList(filterIssues(search.value));
      result.innerHTML = `<div class="kicker">Likely starting point</div><h2>${i.label}</h2><p>${i.summary}</p><div class="data-strip" style="grid-template-columns:1fr 1fr;margin:22px 0"><div class="data-tile"><span>Primary authority</span><strong style="font-size:1.05rem;margin-top:5px">${i.primary}</strong></div><div class="data-tile"><span>Agency / regulator</span><strong style="font-size:1.05rem;margin-top:5px">${i.agency}</strong></div></div><div class="callout"><strong>Important:</strong> ${i.caution}</div><div class="source-links">${i.links.map(l=>`<a href="${l.url}" target="_blank" rel="noopener">${l.label} ↗</a>`).join('')}</div>`;
      history.replaceState(null,'',`?issue=${encodeURIComponent(id)}`);
    }
    function filterIssues(q) {
      if(!q.trim()) return issues;
      return issues.map(i=>({i,s:score(i,q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.i);
    }
    search.addEventListener('input',()=>{
      const filtered=filterIssues(search.value); renderList(filtered);
      if(search.value.trim() && filtered.length && !filtered.some(i=>i.id===activeId)) show(filtered[0].id);
    });
    const params=new URLSearchParams(location.search); const issue=params.get('issue'); const q=params.get('q');
    if(q){search.value=q; const f=filterIssues(q); renderList(f); if(f[0])show(f[0].id);}
    else {renderList(issues); show(issue && issues.some(i=>i.id===issue) ? issue : issues[0].id);}
  }

  const chart = $('#premium-chart');
  if(chart && window.HOT_PREMIUM_HISTORY){
    const data=window.HOT_PREMIUM_HISTORY; const max=Math.max(...data.map(d=>d.value));
    chart.innerHTML=data.map(d=>`<div class="bar-wrap"><div class="bar" style="height:${Math.round((d.value/max)*100)}%"><span class="bar-value">$${d.value.toLocaleString()}</span></div><span class="bar-label">${String(d.year).slice(2)}</span></div>`).join('');
  }

  const hoaForm=$('#hoa-search-form');
  if(hoaForm){hoaForm.addEventListener('submit',e=>{e.preventDefault();const name=$('#hoa-name').value.trim();const city=$('#hoa-city').value.trim();const zip=$('#hoa-zip').value.trim();const u=new URL('https://www.hoa.texas.gov/management-certificates-search'); if(name)u.searchParams.set('combine',name);if(city)u.searchParams.set('hoa_city',city);if(zip)u.searchParams.set('zip',zip);location.href=u.toString();});}

  const tdlrForm=$('#tdlr-search-form');
  if(tdlrForm){tdlrForm.addEventListener('submit',e=>{e.preventDefault();const q=$('#tdlr-query').value.trim();const u=new URL('https://data.texas.gov/d/7358-krk7'); if(q) u.hash=`q=${encodeURIComponent(q)}`; location.href=u.toString();});}
})();
