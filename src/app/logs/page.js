'use client'
// src/app/logs/page.js
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import AppShell from '@/components/AppShell'
import { Badge, Alert, Spinner } from '@/components/ui'

const LEVELS    = ['', 'info', 'warn', 'error', 'debug']
const CATS      = ['', 'auth', 'user', 'api', 'db', 'middleware']
const PAGE_SIZE = 50

const LEVEL_BADGE = { info:'blue', warn:'yellow', error:'red', debug:'green' }
const CAT_COLOR   = { auth:'#C4621D', user:'#1D4E89', api:'#2D6A4F', db:'#6B21A8', middleware:'#92400E' }

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card" style={{ borderLeft: `3px solid ${color || 'var(--accent)'}` }}>
      <div style={{ fontSize: '0.78em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: color || 'var(--accent)', marginBottom: '0.4rem' }}>{label}</div>
      <div className="stat-value" style={{ fontSize: '1.8em' }}>{value ?? '—'}</div>
      {sub && <div className="stat-label">{sub}</div>}
    </div>
  )
}

const TABS = [
  { id: 'overview', label: '⊞ Overview',       roles: ['manager','admin'] },
  { id: 'logs',     label: '◉ System Logs',     roles: ['manager','admin'] },
  { id: 'changes',  label: '⟳ Profile Changes', roles: ['manager','admin'] },
  { id: 'db',       label: '⚙ DB Admin',         roles: ['admin'] },
]

export default function LogsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    if (!loading && !user) router.push('/')
    if (!loading && user && user.role === 'employee') router.push('/dashboard')
  }, [user, loading, router])

  if (loading || !user) return null
  const availTabs = TABS.filter(t => t.roles.includes(user.role))

  return (
    <AppShell>
      <h1 className="page-title">Logs & Administration</h1>
      <div style={{ display:'flex', gap:'0.25rem', marginBottom:'1.5rem', borderBottom:'1px solid var(--border)' }}>
        {availTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'0.6rem 1.1rem', border:'none', background:'none', cursor:'pointer',
            fontFamily:'var(--font-body)', fontWeight:600, fontSize:'0.85em',
            color: tab===t.id ? 'var(--accent)' : 'var(--text2)',
            borderBottom: tab===t.id ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom:'-1px', transition:'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>
      {tab === 'overview' && <OverviewTab />}
      {tab === 'logs'     && <LogsTab user={user} />}
      {tab === 'changes'  && <ChangesTab />}
      {tab === 'db'       && user.role === 'admin' && <DbAdminTab />}
    </AppShell>
  )
}

function OverviewTab() {
  const [stats, setStats]     = useState(null)
  const [dbStats, setDbStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/logs?type=stats').then(r=>r.json()).catch(()=>({})),
      fetch('/api/db-admin?type=stats').then(r=>r.json()).catch(()=>({})),
    ]).then(([s,d]) => { setStats(s); setDbStats(d) }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{textAlign:'center',padding:'3rem'}}><Spinner size={32}/></div>

  return (
    <div>
      {dbStats?.users && (
        <>
          <p className="card-title" style={{marginBottom:'1rem'}}>Database</p>
          <div className="grid-3" style={{marginBottom:'1.5rem'}}>
            <StatCard label="Total Users"   value={dbStats.users.total_users}   color="var(--accent)" />
            <StatCard label="Active Users"  value={dbStats.users.active_users}  color="var(--green)" />
            <StatCard label="Chat Messages" value={dbStats.chats?.total_messages} color="#1D4E89" />
          </div>
          <div className="card" style={{marginBottom:'1.5rem'}}>
            <p className="card-title">Table Sizes</p>
            <div className="table-wrap">
              <table><thead><tr><th>Table</th><th>Size</th></tr></thead>
                <tbody>{dbStats.tables?.map(t=>(
                  <tr key={t.tablename}>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:'0.88em'}}>{t.tablename}</td>
                    <td><Badge type="blue">{t.size}</Badge></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {stats && (
        <>
          <p className="card-title" style={{marginBottom:'1rem'}}>Last 24 Hours — Log Activity</p>
          <div className="grid-2" style={{marginBottom:'1.5rem'}}>
            <div className="card">
              <p className="card-title">By Level</p>
              {!stats.byLevel?.length
                ? <p style={{color:'var(--text3)',fontSize:'0.88em'}}>No logs yet — appear after user activity.</p>
                : stats.byLevel.map(r=>(
                  <div key={r.level} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.4rem 0',borderBottom:'1px solid var(--border)'}}>
                    <Badge type={LEVEL_BADGE[r.level]||'green'}>{r.level}</Badge>
                    <span style={{fontFamily:'var(--font-mono)',fontWeight:700}}>{r.cnt}</span>
                  </div>
                ))}
            </div>
            <div className="card">
              <p className="card-title">By Category</p>
              {!stats.byCategory?.length
                ? <p style={{color:'var(--text3)',fontSize:'0.88em'}}>No logs yet — appear after user activity.</p>
                : stats.byCategory.map(r=>(
                  <div key={r.category} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.4rem 0',borderBottom:'1px solid var(--border)'}}>
                    <span style={{fontWeight:600,fontSize:'0.88em',color:CAT_COLOR[r.category]||'var(--text)'}}>{r.category}</span>
                    <span style={{fontFamily:'var(--font-mono)',fontWeight:700}}>{r.cnt}</span>
                  </div>
                ))}
            </div>
          </div>
          {stats.errorRate && (
            <div className="grid-3">
              <StatCard label="Total Logs" value={stats.errorRate.total}    color="var(--text2)" sub="last 24h"/>
              <StatCard label="Errors"     value={stats.errorRate.errors}   color="var(--red)"   sub="last 24h"/>
              <StatCard label="Warnings"   value={stats.errorRate.warnings} color="var(--yellow)" sub="last 24h"/>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function LogsTab({ user }) {
  const [logs, setLogs]         = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(0)
  const [loading, setLoading]   = useState(false)
  const [filters, setFilters]   = useState({ level:'', category:'', search:'' })
  const [selected, setSelected] = useState(null)

  const fetchLogs = useCallback(async (f=filters, p=page) => {
    setLoading(true)
    const params = new URLSearchParams({
      limit:PAGE_SIZE, offset:p*PAGE_SIZE,
      ...(f.level    && {level:f.level}),
      ...(f.category && {category:f.category}),
      ...(f.search   && {search:f.search}),
    })
    try {
      const data = await fetch(`/api/logs?${params}`).then(r=>r.json())
      setLogs(data.logs||[]); setTotal(data.total||0)
    } catch {}
    setLoading(false)
  }, [filters, page])

  useEffect(() => { fetchLogs() }, [page]) // eslint-disable-line

  return (
    <div>
      <div className="card" style={{marginBottom:'1.25rem'}}>
        <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap',alignItems:'flex-end'}}>
          {[['level','Level',LEVELS],['category','Category',CATS]].map(([key,label,opts])=>(
            <div className="form-group" key={key} style={{marginBottom:0,minWidth:130}}>
              <label className="form-label">{label}</label>
              <select className="form-input form-select" value={filters[key]}
                onChange={e=>setFilters(f=>({...f,[key]:e.target.value}))}>
                {opts.map(o=><option key={o} value={o}>{o||`All ${label.toLowerCase()}s`}</option>)}
              </select>
            </div>
          ))}
          <div className="form-group" style={{marginBottom:0,flex:1,minWidth:180}}>
            <label className="form-label">Search</label>
            <input className="form-input" type="search" placeholder="action, message, username…"
              value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value}))}
              onKeyDown={e=>e.key==='Enter'&&fetchLogs(filters,0)}/>
          </div>
          <button className="btn btn-primary btn-sm" onClick={()=>{setPage(0);fetchLogs(filters,0)}} disabled={loading}>
            {loading?<Spinner size={14}/>:'Filter'}
          </button>
          {user.role==='admin'&&(
            <button className="btn btn-danger btn-sm" onClick={async()=>{
              if(!confirm('Delete logs older than 30 days?'))return
              await fetch('/api/logs?days=30',{method:'DELETE'})
              fetchLogs(filters,0)
            }}>Clear &gt;30d</button>
          )}
        </div>
      </div>

      {selected && (
        <div className="card" style={{marginBottom:'1.25rem',borderColor:'var(--accent)',borderLeftWidth:3}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
            <p className="card-title" style={{margin:0}}>Log Detail</p>
            <button className="btn btn-ghost btn-sm" onClick={()=>setSelected(null)}>✕</button>
          </div>
          <dl style={{display:'grid',gridTemplateColumns:'140px 1fr',gap:'0.4rem 1rem',fontSize:'0.85em'}}>
            {[['ID',selected.id],['Time',new Date(selected.created_at).toLocaleString()],
              ['Level',selected.level],['Category',selected.category],['Action',selected.action],
              ['User',selected.username||'—'],['IP',selected.ip||'—'],['Path',selected.path||'—'],
              ['Status',selected.status_code||'—'],['Duration',selected.duration_ms?selected.duration_ms+'ms':'—'],
              ['Message',selected.message||'—']
            ].map(([k,v])=>(<>
              <dt key={'k'+k} style={{color:'var(--text3)',fontWeight:700,textTransform:'uppercase',fontSize:'0.72em',letterSpacing:'0.07em'}}>{k}</dt>
              <dd key={'v'+k} style={{fontFamily:'var(--font-mono)',wordBreak:'break-all',fontSize:'0.88em'}}>{String(v)}</dd>
            </>))}
            {selected.metadata&&(<>
              <dt style={{color:'var(--text3)',fontWeight:700,textTransform:'uppercase',fontSize:'0.72em',letterSpacing:'0.07em'}}>Metadata</dt>
              <dd><pre style={{background:'var(--bg)',padding:'0.5rem',borderRadius:'6px',fontSize:'0.82em',overflow:'auto',maxHeight:200}}>{JSON.stringify(selected.metadata,null,2)}</pre></dd>
            </>)}
          </dl>
        </div>
      )}

      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
          <p className="card-title" style={{margin:0}}>{total} log{total!==1?'s':''} found</p>
          <button className="btn btn-ghost btn-sm" onClick={()=>fetchLogs()}>↻ Refresh</button>
        </div>
        {loading ? <div style={{textAlign:'center',padding:'2rem'}}><Spinner size={28}/></div>
        : logs.length===0 ? <p style={{color:'var(--text3)',textAlign:'center',padding:'2rem',fontSize:'0.9em'}}>No logs yet. They are written automatically as users interact with the site.</p>
        : (<>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>Level</th><th>Category</th><th>Action</th><th>User</th><th>Message</th><th></th></tr></thead>
              <tbody>
                {logs.map(l=>(
                  <tr key={l.id} style={{cursor:'pointer'}} onClick={()=>setSelected(l)}>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:'0.78em',whiteSpace:'nowrap',color:'var(--text3)'}}>
                      {new Date(l.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
                      <div>{new Date(l.created_at).toLocaleDateString()}</div>
                    </td>
                    <td><Badge type={LEVEL_BADGE[l.level]||'green'}>{l.level}</Badge></td>
                    <td><span style={{fontWeight:600,fontSize:'0.82em',color:CAT_COLOR[l.category]||'var(--text)'}}>{l.category}</span></td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:'0.82em',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.action}</td>
                    <td style={{fontSize:'0.85em',color:'var(--text2)'}}>{l.username||'—'}</td>
                    <td style={{fontSize:'0.82em',color:'var(--text2)',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.message||'—'}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();setSelected(l)}}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{display:'flex',gap:'0.5rem',alignItems:'center',marginTop:'1rem',justifyContent:'center'}}>
            <button className="btn btn-secondary btn-sm" disabled={page===0} onClick={()=>setPage(p=>p-1)}>← Prev</button>
            <span style={{fontSize:'0.85em',color:'var(--text2)'}}>Page {page+1} of {Math.max(1,Math.ceil(total/PAGE_SIZE))}</span>
            <button className="btn btn-secondary btn-sm" disabled={(page+1)*PAGE_SIZE>=total} onClick={()=>setPage(p=>p+1)}>Next →</button>
          </div>
        </>)}
      </div>
    </div>
  )
}

function ChangesTab() {
  const [changes, setChanges] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/db-admin?type=changes').then(r=>r.json())
      .then(d=>setChanges(d.changes||[])).catch(()=>{}).finally(()=>setLoading(false))
  }, [])

  if (loading) return <div style={{textAlign:'center',padding:'3rem'}}><Spinner size={32}/></div>

  return (
    <div className="card">
      <p className="card-title">All Profile Changes ({changes.length})</p>
      {changes.length===0
        ? <p style={{color:'var(--text3)',fontSize:'0.9em',textAlign:'center',padding:'2rem'}}>No profile changes recorded yet.</p>
        : <div className="table-wrap"><table>
            <thead><tr><th>Time</th><th>Target</th><th>Field</th><th>Old</th><th>New</th><th>By</th></tr></thead>
            <tbody>
              {changes.map(c=>(
                <tr key={c.id}>
                  <td style={{fontFamily:'var(--font-mono)',fontSize:'0.78em',color:'var(--text3)',whiteSpace:'nowrap'}}>{new Date(c.changed_at).toLocaleString()}</td>
                  <td style={{fontWeight:600,fontSize:'0.88em'}}>{c.target_name}</td>
                  <td><span style={{fontFamily:'var(--font-mono)',fontSize:'0.82em',color:'var(--accent)'}}>{c.field_name}</span></td>
                  <td style={{color:'var(--red)',fontSize:'0.82em',fontFamily:'var(--font-mono)',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis'}}>{c.old_value||'—'}</td>
                  <td style={{color:'var(--green)',fontSize:'0.82em',fontFamily:'var(--font-mono)',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis'}}>{c.new_value||'—'}</td>
                  <td style={{fontSize:'0.85em',color:'var(--text2)'}}>{c.changed_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
      }
    </div>
  )
}

function DbAdminTab() {
  const [stats, setStats]     = useState(null)
  const [sql, setSql]         = useState('')
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState('')
  const [running, setRunning] = useState(false)

  useEffect(() => {
    fetch('/api/db-admin?type=stats').then(r=>r.json()).then(setStats).catch(()=>{})
  }, [])

  async function runQuery() {
    if (!sql.trim()) return
    setRunning(true); setError(''); setResult(null)
    try {
      const res  = await fetch('/api/db-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sql})})
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setResult(data)
    } catch(e) { setError(e.message) }
    setRunning(false)
  }

  const SAMPLES = [
    'SELECT username, role, is_active, created_at FROM users ORDER BY created_at DESC',
    'SELECT category, action, COUNT(*) AS cnt FROM system_logs GROUP BY category, action ORDER BY cnt DESC LIMIT 20',
    'SELECT u.username, COUNT(cm.id) AS messages FROM users u LEFT JOIN chat_messages cm ON cm.user_id = u.id GROUP BY u.username ORDER BY messages DESC',
    'SELECT field_name, COUNT(*) AS changes FROM profile_changes GROUP BY field_name ORDER BY changes DESC',
  ]

  return (
    <div>
      {stats?.users && (
        <div className="grid-3" style={{marginBottom:'1.5rem'}}>
          <StatCard label="Users"    value={stats.users.total_users}    color="var(--accent)"/>
          <StatCard label="Messages" value={stats.chats?.total_messages} color="#1D4E89"/>
          <StatCard label="Logs"     value={stats.logs?.total_logs}      color="var(--green)"/>
        </div>
      )}
      <div className="card">
        <p className="card-title">⚙ SQL Query Runner</p>
        <p style={{color:'var(--text2)',fontSize:'0.85em',marginBottom:'1rem'}}>Read-only SELECT queries only. Password fields are blocked.</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem',marginBottom:'0.75rem'}}>
          {SAMPLES.map((q,i)=>(
            <button key={i} className="btn btn-secondary btn-sm" style={{fontSize:'0.75em'}} onClick={()=>setSql(q)}>Sample {i+1}</button>
          ))}
        </div>
        <textarea className="form-input" rows={5}
          style={{fontFamily:'var(--font-mono)',fontSize:'0.85em',resize:'vertical',marginBottom:'0.75rem'}}
          placeholder="SELECT username, role FROM users WHERE is_active = TRUE"
          value={sql} onChange={e=>setSql(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey))runQuery()}}/>
        <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
          <button className="btn btn-primary" onClick={runQuery} disabled={running||!sql.trim()}>
            {running?<Spinner size={16}/>:'▶ Run Query'}
          </button>
          <span style={{fontSize:'0.78em',color:'var(--text3)'}}>Ctrl+Enter to run</span>
        </div>
        {error&&<div className="alert alert-error" style={{marginTop:'1rem'}}>✖ {error}</div>}
        {result&&(
          <div style={{marginTop:'1.25rem'}}>
            <div style={{marginBottom:'0.5rem',fontSize:'0.82em',color:'var(--text2)'}}>{result.count} row{result.count!==1?'s':''} · {result.duration}ms</div>
            {result.rows?.length>0&&(
              <div className="table-wrap" style={{maxHeight:400,overflowY:'auto'}}>
                <table>
                  <thead><tr>{Object.keys(result.rows[0]).map(k=><th key={k}>{k}</th>)}</tr></thead>
                  <tbody>{result.rows.map((row,i)=>(
                    <tr key={i}>{Object.values(row).map((v,j)=>(
                      <td key={j} style={{fontFamily:'var(--font-mono)',fontSize:'0.82em',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {v===null?<span style={{color:'var(--text3)'}}>NULL</span>:String(v)}
                      </td>
                    ))}</tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
