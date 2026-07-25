import { useCallback,useEffect,useState,type FormEvent } from 'react';
import type { AccountMountOptions,AccountSection,AccountSession,AccountUser } from './account-types';
import './react-account.css';

const message=(reason:unknown)=>reason instanceof Error?reason.message:'The request could not be completed.';
const formatDate=(value:string)=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const themes=[
  ['dark','Vynode Core'],['obsidian','Obsidian'],['aurora','Aurora'],['cyber','Cyber Blue'],['nebula','Nebula'],
  ['synthwave','Synthwave'],['oceanic','Oceanic'],['ember','Ember'],['matrix','Matrix'],['frost','Frost'],
] as const;

function Tabs({section,administrator}:{section:AccountSection;administrator:boolean}){
  return <nav className="settings-tabs" aria-label="Account settings">
    <a className={section==='account'?'active':''} href="#settings/account">My account</a>
    <a className={section==='sessions'?'active':''} href="#settings/sessions">Active sessions</a>
    {administrator?<a className={section==='users'?'active':''} href="#settings/users">Users</a>:null}
  </nav>;
}

function AccountForm({options}:{options:AccountMountOptions}){
  const [user,setUser]=useState<AccountUser|null>(null),[saving,setSaving]=useState(false),[error,setError]=useState('');
  useEffect(()=>{void options.request<{user:AccountUser}>('/api/account').then(value=>setUser(value.user)).catch(reason=>setError(message(reason)));},[options]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSaving(true);
    const form=new FormData(event.currentTarget),payload=Object.fromEntries(form.entries());
    try{const value=await options.request<{user:AccountUser}>('/api/account',{method:'PATCH',body:JSON.stringify(payload)});setUser(value.user);options.onUserUpdated(value.user);options.notify('Account updated.');}
    catch(reason){options.notify(message(reason),'error');}finally{setSaving(false);}
  }
  if(error)return <div className="empty error-state"><h2>Account unavailable</h2><p>{error}</p></div>;
  if(!user)return <div className="panel skeleton">Loading account…</div>;
  return <form className="panel settings-form" onSubmit={submit}>
    <h2>Profile</h2>
    <div className="form-grid"><label>Display name<input name="name" defaultValue={user.name} required/></label><label>Username<input name="username" defaultValue={user.username} required/></label></div>
    <label>Email<input name="email" type="email" defaultValue={user.email} required/></label>
    <div className="form-grid"><label>Profile image URL<input name="profileImage" defaultValue={user.profileImage||''} placeholder="Optional"/></label><label>Time zone<input name="timeZone" defaultValue={user.timeZone||'UTC'}/></label></div>
    <div className="form-grid"><label>Date/time format<select name="dateTimeFormat" defaultValue={user.dateTimeFormat||'locale'}><option value="locale">Regional default</option><option value="24h">24-hour</option><option value="12h">12-hour</option></select></label><label>Interface theme<select name="theme" defaultValue={themes.some(([value])=>value===user.theme)?user.theme:'dark'}>{themes.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select><small className="theme-hint">Ten clean color systems; layout and functionality stay unchanged.</small></label></div>
    <label>Language<select name="language" defaultValue={user.language||'en'}><option value="en">English</option></select></label>
    <hr/><h2>Change password</h2>
    <div className="form-grid three"><label>Current password<input name="currentPassword" type="password" autoComplete="current-password"/></label><label>New password<input name="newPassword" type="password" autoComplete="new-password"/></label><label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password"/></label></div>
    <div className="form-actions"><button className="primary" disabled={saving} type="submit">{saving?'Saving…':'Save account'}</button></div>
  </form>;
}

function Sessions({options}:{options:AccountMountOptions}){
  const [items,setItems]=useState<AccountSession[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=useCallback(async()=>{setLoading(true);try{const value=await options.request<{items:AccountSession[]}>('/api/account/sessions');setItems(value.items);setError('');}catch(reason){setError(message(reason));}finally{setLoading(false);}},[options]);
  useEffect(()=>{void load();},[load]);
  async function revoke(id:string){try{const result=await options.request<{current:boolean}>(`/api/account/sessions/${id}`,{method:'DELETE'});if(result.current)return options.onCurrentSessionRevoked();options.notify('Session revoked.');await load();}catch(reason){options.notify(message(reason),'error');}}
  async function revokeOthers(){try{await options.request('/api/account/sessions/others',{method:'DELETE'});options.notify('Other sessions signed out.');await load();}catch(reason){options.notify(message(reason),'error');}}
  if(error)return <div className="empty error-state"><h2>Sessions unavailable</h2><p>{error}</p><button className="secondary" onClick={()=>void load()}>Try again</button></div>;
  return <><div className="account-section-actions"><span>{items.length} signed-in session{items.length===1?'':'s'}</span><button className="secondary" disabled={loading} onClick={()=>void revokeOthers()}>Sign out all other sessions</button></div><div className={`panel session-list${loading?' is-loading':''}`}>{items.map(item=><article key={item.id}><div><h2>{item.browser} on {item.os} {item.current?<span className="badge green">Current</span>:null}</h2><p>{item.ipMasked} · Last active {formatDate(item.lastActivity)} · Created {formatDate(item.createdAt)}</p></div><button className="text-button" onClick={()=>void revoke(item.id)}>{item.current?'Sign out this session':'Revoke'}</button></article>)}</div></>;
}

function Users({options}:{options:AccountMountOptions}){
  const [items,setItems]=useState<AccountUser[]>([]),[loading,setLoading]=useState(true),[creating,setCreating]=useState(false),[error,setError]=useState('');
  const load=useCallback(async()=>{setLoading(true);try{const value=await options.request<{items:AccountUser[]}>('/api/admin/users');setItems(value.items);setError('');}catch(reason){setError(message(reason));}finally{setLoading(false);}},[options]);
  useEffect(()=>{void load();},[load]);
  async function create(event:FormEvent<HTMLFormElement>){event.preventDefault();try{await options.request('/api/admin/users',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries()))});setCreating(false);options.notify('User created.');await load();}catch(reason){options.notify(message(reason),'error');}}
  async function action(user:AccountUser,value:string){if(!value)return;const payload:Record<string,string>={action:value};if(value==='role'){const role=prompt('Role: administrator or viewer',user.role);if(!role)return;payload.role=role;}if(value==='resetPassword'){const password=prompt('New temporary password (12+ characters)');if(!password)return;payload.password=password;}if(value==='delete'&&!confirm(`Delete ${user.name}? This cannot be undone.`))return;try{await options.request(`/api/admin/users/${user.id}`,{method:'PATCH',body:JSON.stringify(payload)});options.notify('User updated.');await load();}catch(reason){options.notify(message(reason),'error');}}
  if(error)return <div className="empty error-state"><h2>Users unavailable</h2><p>{error}</p></div>;
  return <><div className="account-section-actions"><span>{items.length} local user{items.length===1?'':'s'}</span><button className="primary" onClick={()=>setCreating(true)}>Create user</button></div><div className={`panel user-list${loading?' is-loading':''}`}>{items.map(user=><article key={user.id}><div className="user-avatar">{(user.name||user.username).slice(0,1)}</div><div><h2>{user.name}</h2><p>{user.username} · {user.email}</p></div><span className="badge">{user.role}</span><span className={`badge ${user.enabled?'green':'warm'}`}>{user.enabled?'Enabled':'Disabled'}</span><select className="user-action" aria-label={`Actions for ${user.name}`} defaultValue="" onChange={event=>{void action(user,event.target.value);event.target.value='';}}><option value="">Actions…</option><option value={user.enabled?'disable':'enable'}>{user.enabled?'Disable':'Enable'}</option><option value="forceLogout">Force logout</option><option value="role">Change role</option><option value="resetPassword">Reset password</option><option value="delete">Delete</option></select></article>)}</div>
    {creating?<div className="react-dialog-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setCreating(false);}}><form className="panel react-account-dialog" onSubmit={create}><h2>Create user</h2><label>Display name<input name="name" required/></label><label>Username<input name="username" required/></label><label>Email<input name="email" type="email" required/></label><label>Temporary password<input name="password" type="password" minLength={12} required/></label><label>Role<select name="role"><option value="viewer">Viewer</option><option value="administrator">Administrator</option></select></label><div className="form-actions"><button type="button" className="secondary" onClick={()=>setCreating(false)}>Cancel</button><button className="primary" type="submit">Create</button></div></form></div>:null}
  </>;
}

export function AccountView({options}:{options:AccountMountOptions}){
  const section=options.section==='users'&&!options.administrator?'account':options.section,title=section==='sessions'?'Active Sessions':section==='users'?'Users':'My Account';
  return <div className="react-account"><div className="hero"><div><span className="eyebrow">{section==='users'?'ADMINISTRATION':'SETTINGS'}</span><h1>{title}</h1><p className="lede">{section==='account'?'Your identity and VynodeArr preferences.':section==='sessions'?'Review and revoke devices signed into your account.':'Manage local access, roles, and account status.'}</p></div></div><Tabs section={section} administrator={options.administrator}/>{section==='account'?<AccountForm options={options}/>:section==='sessions'?<Sessions options={options}/>:<Users options={options}/>}</div>;
}
