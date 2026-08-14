export type AccountTab='account'|'sessions'|'engines'|'users';

export function AccountTabs({active,administrator}:{active:AccountTab;administrator:boolean}){
  return <nav className="settings-tabs" aria-label="Account settings">
    <a className={active==='account'?'active':undefined} href="#settings/account">My account</a>
    <a className={active==='sessions'?'active':undefined} href="#settings/sessions">Active sessions</a>
    {administrator?<a className={active==='users'?'active':undefined} href="#settings/users">Users</a>:null}
  </nav>;
}
