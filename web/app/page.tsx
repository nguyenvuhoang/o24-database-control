'use client';

import './monitor-navigation.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import LogoutButton from './components/LogoutButton';
import type { ServerSnapshot, Job, DbBackup } from '../lib/types';

type Data = { servers: ServerSnapshot[]; fetchedAt: string };
type View = 'overview' | 'backup-jobs' | 'databases' | 'agents' | 'events';
const menu: { href: string; label: string; icon: string; view: View }[] = [
  { href: '/', label: 'Overview', icon: '▦', view: 'overview' },
  { href: '/backup-jobs', label: 'Backup Jobs', icon: '▤', view: 'backup-jobs' },
  { href: '/databases', label: 'Databases', icon: '▥', view: 'databases' },
  { href: '/agents', label: 'Windows / Linux Agents', icon: '▣', view: 'agents' },
  { href: '/events', label: 'Event History', icon: '◷', view: 'events' },
];
const titles: Record<View, { title: string; description: string }> = {
  overview: {title:'Database Control Center',description:'Live overview of SQL Server backup jobs, database health and backup artifacts.'},
  'backup-jobs': {title:'Backup Jobs',description:'Windows Task Scheduler status, last execution, next run and exit result.'},
  databases: {title:'Databases',description:'Read-only SQL Server database status and FULL / LOG backup history.'},
  agents: {title:'Windows / Linux Agents',description:'Agent connectivity, heartbeat and last reported server metrics.'},
  events: {title:'Event History',description:'Recent backup log lines from the latest agent snapshot (not a persistent audit history).'},
};
function fmt(value: string | null | undefined) {
  if (!value) return '—';
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleString('vi-VN', { hour12:false });
}
function status(job: Job): [string,string] {
  if (job.state?.toLowerCase() === 'running') return ['RUNNING','blue'];
  if (job.lastResult !== null && job.lastResult !== undefined && job.lastResult !== 0) return ['ERROR','red'];
  if (!job.lastRun) return ['NOT RUN','amber'];
  if (job.nextRun && new Date(job.nextRun).getTime() < Date.now() - 120000) return ['CHECK SCHEDULE','amber'];
  return ['READY','green'];
}
function backupAge(value: string | null, hours: number): [string,string] {
  if (!value) return ['NO BACKUP','red'];
  return Date.now() - new Date(value).getTime() > hours*3600000 ? ['STALE','amber'] : ['FRESH','green'];
}
function JobTable({jobs}:{jobs:Job[]}) {
  return <div className="tablewrap"><table><thead><tr><th>JOB NAME</th><th>STATUS</th><th>LAST EXECUTION</th><th>NEXT RUN</th><th>RESULT</th><th>RUN AS</th></tr></thead><tbody>
    {jobs.map(job=>{const [label,tone]=status(job); return <tr key={job.name}><td className="name">{job.name}</td><td><span className={'pill '+tone}>{label}</span></td><td>{fmt(job.lastRun)}</td><td>{fmt(job.nextRun)}</td><td>{job.lastResult ?? '—'}</td><td>{job.runAs || '—'}</td></tr>;})}
    {jobs.length===0&&<tr><td colSpan={6} className="table-empty">No job data received</td></tr>}
  </tbody></table></div>;
}
function DatabaseTable({databases}:{databases:DbBackup[]}) {
  return <div className="tablewrap"><table><thead><tr><th>DATABASE</th><th>STATE</th><th>RECOVERY</th><th>LAST FULL</th><th>LAST LOG</th><th>LOG HEALTH</th></tr></thead><tbody>
    {databases.map(db=>{const [label,tone]=backupAge(db.lastLog,2); return <tr key={db.name}><td className="name">{db.name}</td><td><span className={'pill '+(db.state==='ONLINE'?'good':'bad')}>{db.state}</span></td><td>{db.recovery}</td><td>{fmt(db.lastFull)}</td><td>{fmt(db.lastLog)}</td><td><span className={'pill '+(db.state==='ONLINE'?tone:'muted')}>{db.state==='ONLINE'?label:'N/A'}</span></td></tr>;})}
    {databases.length===0&&<tr><td colSpan={6} className="table-empty">No database data received</td></tr>}
  </tbody></table></div>;

}
function formatLogLine(line: unknown): string {
  if (typeof line === 'string') return line;

  if (line === null || line === undefined) return '';

  if (typeof line === 'object') {
    const obj = line as Record<string, unknown>;

    if (typeof obj.value === 'string') {
      return obj.value;
    }

    return JSON.stringify(obj);
  }

  return String(line);
}
function ArtifactsAndLogs({server}:{server:ServerSnapshot}) {
  return <div className="bottom-grid"><section className="panel"><h3>Recent Backup Artifacts</h3><p>Latest local ZIP files reported by the Agent</p>{server.snapshot.artifacts.map(file=><div className="artifact" key={file.name}><span>▣ {file.name}</span><b>{(file.bytes / 1024 / 1024).toFixed(1)} MB</b></div>)}{!server.snapshot.artifacts.length&&<div className="empty">No ZIP artifacts found</div>}</section><section className="panel"><h3>Latest Backup Log</h3><p>Read-only output from the most recent reported log</p><div className="terminal">{server.snapshot.logLines.length ? server.snapshot.logLines.map((line,i)=><div key={i}>{formatLogLine(line)}</div>) : 'No log lines available'}</div></section></div>;
}
export default function MonitorDashboard() {
  const path=usePathname();
  const view:View = path==='/backup-jobs'?'backup-jobs':path==='/databases'?'databases':path==='/agents'?'agents':path==='/events'?'events':'overview';
  const [data,setData]=useState<Data|null>(null);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState('');
  const [lastRefresh,setLastRefresh]=useState('');
  const refresh=useCallback(async()=>{
    try {
      const res=await fetch('/api/overview',{cache:'no-store'});
      if (!res.ok) throw new Error(`API ${res.status}`);
      const next:Data=await res.json();
      setData(next);setError('');setLastRefresh(new Date().toLocaleTimeString('vi-VN'));
    } catch(err){setError(err instanceof Error ? err.message : 'Connection failed');}
  },[]);
  useEffect(()=>{
    void refresh();
    const interval=setInterval(()=>{void refresh();},15000);
    return ()=>clearInterval(interval);
  },[refresh]);
  const all=data?.servers??[];
  const server=all.find(item=>item.snapshot.agentId===selected)??all[0];
  const jobs=server?.snapshot.jobs??[];
  const databases=server?.snapshot.databases??[];
  const jobErrors=jobs.filter(j=>j.lastResult!==null&&j.lastResult!==undefined&&j.lastResult!==0).length;
  const onlineDatabases=databases.filter(db=>db.state==='ONLINE').length;
  return <div className="shell">
    <aside className="sidebar">
      <Link href="/" className="brand"><div className="brand-icon">◈</div><div><strong>O24 Control</strong><small>DATABASE MONITOR</small></div></Link>
      <div className="nav-section">WORKSPACE</div>
      {menu.slice(0,3).map(item=><Link key={item.view} href={item.href} className={'nav'+(view===item.view?' active':'')}><span aria-hidden="true">{item.icon}</span><span>{item.label}</span></Link>)}
      <div className="nav-section">INFRASTRUCTURE</div>
      {menu.slice(3).map(item=><Link key={item.view} href={item.href} className={'nav'+(view===item.view?' active':'')}><span aria-hidden="true">{item.icon}</span><span>{item.label}</span></Link>)}
      <div className="sidefoot">READ-ONLY MODE<br/>No remote execution enabled</div>
    </aside>
    <main className="main">
      <div className="topbar"><div className="breadcrumb">Infrastructure <span>/</span> Database Monitoring <span>/</span> {menu.find(m=>m.view===view)?.label}</div><div className="topright"><span className="live-dot"/> Auto refresh · 15s <LogoutButton/></div></div>
      <div className="heading"><div><div className="eyebrow">OPERATIONS / LIVE MONITORING</div><h1>{titles[view].title}</h1><p>{titles[view].description}</p></div><button type="button" onClick={()=>void refresh()}>↻ Refresh</button></div>
      {error&&<div role="alert" className="error">Could not load telemetry: {error}</div>}
      {view==='overview'&&<div className="cards">
        <div className="metric"><div className="metriclabel">Connected Agents</div><strong>{all.filter(s=>s.online).length}<span> / {all.length}</span></strong><div className="hint">Heartbeat within 3 minutes</div></div>
        <div className="metric"><div className="metriclabel">Monitored Jobs</div><strong>{jobs.length}</strong><div className="hint">Task Scheduler integration</div></div>
        <div className="metric"><div className="metriclabel">Online Databases</div><strong>{onlineDatabases}<span> / {databases.length}</span></strong><div className="hint">Selected SQL instance</div></div>
        <div className="metric"><div className="metriclabel">Job Errors</div><strong className={jobErrors?'danger':''}>{jobErrors}</strong><div className="hint">Last reported task results</div></div>
      </div>}
      <div className="section-head"><div><h2>{view==='overview'?'Server Overview':'Monitoring Source'}</h2><p>Latest agent snapshot and database health</p></div><span className="updated">Last refresh: {lastRefresh||'—'}</span></div>
      {all.length===0?<div className="empty">No agent data yet. Send one authorized telemetry snapshot to populate the dashboard.</div>:<div className="serverbar"><div><span className="dot" style={{background:server?.online?'#44d6a5':'#f16c79'}}/>{server?.snapshot.serverName}<span className="small"> · {server?.snapshot.instance}</span></div><select aria-label="Select monitoring server" value={server?.snapshot.agentId??''} onChange={e=>setSelected(e.target.value)}>{all.map(s=><option key={s.snapshot.agentId} value={s.snapshot.agentId}>{s.snapshot.serverName} ({s.snapshot.agentId})</option>)}</select><span className={'pill '+(server?.online?'good':'bad')}>{server?.online?'AGENT ONLINE':'AGENT OFFLINE'}</span></div>}
      {server&&<div className="small-stats"><span>Last heartbeat <b>{fmt(server.receivedAt)}</b></span><span>Disk free <b>{server.snapshot.diskFreeGB??'—'} GB</b></span><span>Agent ID <b>{server.snapshot.agentId}</b></span></div>}
      {view==='overview'&&server&&<>
        <div className="section-head"><div><h2>Scheduled Backup Jobs</h2><p>Latest Task Scheduler snapshot</p></div><Link className="section-link" href="/backup-jobs">View all jobs</Link></div><JobTable jobs={jobs}/>
        <div className="section-head"><div><h2>Database Backup Health</h2><p>FULL and LOG backup timestamps from SQL Server msdb</p></div><Link className="section-link" href="/databases">View databases</Link></div><DatabaseTable databases={databases}/>
        <ArtifactsAndLogs server={server}/>
      </>}
      {view==='backup-jobs'&&<><div className="section-head"><div><h2>Scheduled Backup Jobs</h2><p>Read-only; cannot start or stop jobs from this dashboard</p></div></div><JobTable jobs={jobs}/></>}
      {view==='databases'&&<><div className="section-head"><div><h2>Database Backup Health</h2><p>Last reported FULL and LOG backup dates</p></div></div><DatabaseTable databases={databases}/></>}
      {view==='agents'&&<><div className="section-head"><div><h2>Registered Agents</h2><p>Connectivity is inferred from most recent received telemetry</p></div></div><div className="tablewrap"><table><thead><tr><th>AGENT ID</th><th>SERVER</th><th>INSTANCE</th><th>STATUS</th><th>LAST HEARTBEAT</th><th>DISK FREE</th></tr></thead><tbody>{all.map(item=><tr key={item.snapshot.agentId}><td className="name">{item.snapshot.agentId}</td><td>{item.snapshot.serverName}</td><td>{item.snapshot.instance}</td><td><span className={'pill '+(item.online?'good':'bad')}>{item.online?'ONLINE':'OFFLINE'}</span></td><td>{fmt(item.receivedAt)}</td><td>{item.snapshot.diskFreeGB??'—'} GB</td></tr>)}{all.length===0&&<tr><td className="table-empty" colSpan={6}>No agents have sent telemetry yet</td></tr>}</tbody></table></div></>}
      {view==='events'&&<><div className="section-head"><div><h2>Latest Backup Events</h2><p>Lines from the latest log in the selected Agent snapshot. Persistent event history is not implemented in V0.1.</p></div></div>{server?<div className="panel"><div className="terminal terminal-large">{server.snapshot.logLines.length?server.snapshot.logLines.map((line,i)=><div key={i}>{formatLogLine(line)}</div>):'No log events available'}</div></div>:<div className="empty">No events available until an Agent reports telemetry.</div>}</>}
      <footer>O24 Database Control Center · Read-only telemetry · No task execution · {data?.fetchedAt?fmt(data.fetchedAt):'Waiting for data'}</footer>
    </main>
  </div>;
}
