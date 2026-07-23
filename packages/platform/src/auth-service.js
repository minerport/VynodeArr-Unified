import { randomBytes,scryptSync,timingSafeEqual } from 'node:crypto';
import { dirname,join } from 'node:path';
import { JsonStore } from './json-store.js';

const encode=(value)=>Buffer.from(value).toString('base64url');
const hashPassword=(password,salt=randomBytes(16))=>`${encode(salt)}.${encode(scryptSync(password,salt,64))}`;
const verifyPassword=(password,stored)=>{try{const [salt,expected]=stored.split('.');return timingSafeEqual(scryptSync(password,Buffer.from(salt,'base64url'),64),Buffer.from(expected,'base64url'));}catch{return false;}};
const normalize=(value)=>String(value||'').trim();
const validEmail=(value)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validUsername=(value)=>/^[a-zA-Z0-9._-]{3,64}$/.test(value);
const passwordStrong=(value)=>String(value).length>=12&&/[a-z]/.test(value)&&/[A-Z]/.test(value)&&/\d/.test(value);
const maskIp=(ip='')=>ip.includes(':')?`${ip.split(':').slice(0,3).join(':')}:…`:ip.replace(/\.\d+$/,'.…');
const clientInfo=(agent='')=>({
  browser:/Firefox/i.test(agent)?'Firefox':/Edg/i.test(agent)?'Edge':/Chrome/i.test(agent)?'Chrome':/Safari/i.test(agent)?'Safari':'Unknown browser',
  os:/Windows/i.test(agent)?'Windows':/Mac OS/i.test(agent)?'macOS':/Linux/i.test(agent)?'Linux':/Android/i.test(agent)?'Android':/iPhone|iPad/i.test(agent)?'iOS':'Unknown OS'
});

export class AuthService {
  constructor({userFile,sessionFile=join(dirname(userFile),'sessions.json'),secureCookies=true,sessionTtlMs=86400000,rememberTtlMs=2592000000,rateLimit=8}) {
    this.userStore=new JsonStore(userFile,{version:1,users:[]});
    this.sessionStore=new JsonStore(sessionFile,{version:1,sessions:[]});
    this.secureCookies=secureCookies;this.sessionTtlMs=sessionTtlMs;this.rememberTtlMs=rememberTtlMs;this.rateLimit=rateLimit;this.attempts=new Map();this.users=[];this.sessions=new Map();
  }
  async initialize(){
    const [users,sessions]=await Promise.all([this.userStore.read(),this.sessionStore.read()]);
    const source=Array.isArray(users)?users:(users.users||[]);
    this.users=source.map((user)=>({
      ...user,name:user.name||user.username,email:user.email||`${user.username}@local.invalid`,
      enabled:user.enabled!==false,profileImage:user.profileImage||null,timeZone:user.timeZone||'UTC',
      dateTimeFormat:user.dateTimeFormat||'locale',theme:user.theme||'dark',language:user.language||'en',
      updatedAt:user.updatedAt||user.createdAt||new Date().toISOString()
    }));
    if(Array.isArray(users)||source.some((user)=>!user.name||!user.email))await this.#persistUsers();
    const now=Date.now();for(const session of sessions.sessions||[])if(session.expiresAt>now)this.sessions.set(session.id,session);
    await this.#persistSessions();
  }
  async #persistUsers(){await this.userStore.write({version:1,users:this.users});}
  async #persistSessions(){await this.sessionStore.write({version:1,sessions:[...this.sessions.values()]});}
  async setupRequired(){return this.users.length===0;}
  #assertUnique(username,email,exceptId=null){
    if(this.users.some((user)=>user.id!==exceptId&&user.username.toLowerCase()===username.toLowerCase()))throw new Error('Username is already in use');
    if(this.users.some((user)=>user.id!==exceptId&&user.email.toLowerCase()===email.toLowerCase()))throw new Error('Email is already in use');
  }
  #validateIdentity({name,username,email,password}){
    if(normalize(name).length<2)throw new Error('Display name is required');
    if(!validUsername(username))throw new Error('Username must be 3–64 letters, numbers, dots, dashes, or underscores');
    if(!validEmail(email))throw new Error('Enter a valid email address');
    if(password!=null&&!passwordStrong(password))throw new Error('Password must contain 12 characters, upper and lower case letters, and a number');
  }
  async createInitialAdministrator(input){
    if(!(await this.setupRequired()))throw new Error('Setup is already complete');
    const value={name:normalize(input.name),username:normalize(input.username),email:normalize(input.email).toLowerCase(),password:input.password};
    this.#validateIdentity(value);if(input.password!==input.confirmPassword)throw new Error('Passwords do not match');this.#assertUnique(value.username,value.email);
    const user={id:`user_${encode(randomBytes(12))}`,name:value.name,username:value.username,email:value.email,passwordHash:hashPassword(value.password),role:'administrator',enabled:true,profileImage:null,timeZone:'UTC',dateTimeFormat:'locale',theme:'dark',language:'en',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    this.users.push(user);await this.#persistUsers();return this.publicUser(user);
  }
  publicUser(user){const {passwordHash,...safe}=user;return safe;}
  #allow(ip){const key=ip||'unknown',now=Date.now(),attempt=this.attempts.get(key)||{count:0,resetAt:now+60000};if(now>attempt.resetAt)Object.assign(attempt,{count:0,resetAt:now+60000});attempt.count++;this.attempts.set(key,attempt);return attempt.count<=this.rateLimit;}
  async login(identifier,password,context={}){
    if(!this.#allow(context.ip))return null;const needle=normalize(identifier).toLowerCase();
    const user=this.users.find((candidate)=>candidate.username.toLowerCase()===needle||candidate.email.toLowerCase()===needle);
    if(!user||!user.enabled||!verifyPassword(password,user.passwordHash))return null;this.attempts.delete(context.ip||'unknown');
    return this.createSession(user,context);
  }
  async createSession(user,context={}){
    const id=encode(randomBytes(32)),csrf=encode(randomBytes(24)),now=Date.now(),info=clientInfo(context.userAgent);
    const session={id,userId:user.id,csrf,createdAt:now,lastActivity:now,expiresAt:now+(context.remember?this.rememberTtlMs:this.sessionTtlMs),remember:Boolean(context.remember),ipMasked:maskIp(context.ip),...info};
    this.sessions.set(id,session);await this.#persistSessions();return{id,csrf,user:this.publicUser(user)};
  }
  session(id){
    const session=this.sessions.get(id);if(!session||session.expiresAt<=Date.now()){if(id)this.sessions.delete(id);return null;}
    const user=this.users.find((candidate)=>candidate.id===session.userId);if(!user?.enabled){this.sessions.delete(id);return null;}
    session.lastActivity=Date.now();return{...session,user:this.publicUser(user)};
  }
  async logout(id){const removed=this.sessions.delete(id);await this.#persistSessions();return removed;}
  cookie(id,clear=false,remember=false){const ttl=remember?this.rememberTtlMs:this.sessionTtlMs;return`vynodearr_session=${clear?'':id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear?0:Math.floor(ttl/1000)}${this.secureCookies?'; Secure':''}`;}
  async listSessions(userId,currentId){return[...this.sessions.values()].filter((item)=>item.userId===userId).map(({csrf,...item})=>({...item,current:item.id===currentId,id:item.id===currentId?item.id:`session_${item.id.slice(-10)}`}));}
  async revokeSession(userId,sessionId,currentId){
    const actual=sessionId.startsWith('session_')?[...this.sessions.keys()].find((key)=>key.endsWith(sessionId.slice(8))):sessionId;
    const target=this.sessions.get(actual);if(!target||target.userId!==userId)throw new Error('Session was not found');this.sessions.delete(actual);await this.#persistSessions();return actual===currentId;
  }
  async revokeOtherSessions(userId,currentId){for(const [id,item]of this.sessions)if(item.userId===userId&&id!==currentId)this.sessions.delete(id);await this.#persistSessions();}
  async revokeUserSessions(userId,exceptId=null){for(const [id,item]of this.sessions)if(item.userId===userId&&id!==exceptId)this.sessions.delete(id);await this.#persistSessions();}
  async updateAccount(userId,input,currentSessionId){
    const user=this.users.find((item)=>item.id===userId);if(!user)throw new Error('User was not found');
    const username=normalize(input.username??user.username),email=normalize(input.email??user.email).toLowerCase(),name=normalize(input.name??user.name);
    this.#validateIdentity({name,username,email});this.#assertUnique(username,email,userId);
    Object.assign(user,{name,username,email,profileImage:input.profileImage??user.profileImage,timeZone:input.timeZone||user.timeZone,dateTimeFormat:input.dateTimeFormat||user.dateTimeFormat,theme:input.theme||user.theme,language:input.language||user.language,updatedAt:new Date().toISOString()});
    if(input.newPassword){
      if(!verifyPassword(input.currentPassword,user.passwordHash))throw new Error('Current password was not accepted');
      if(input.newPassword!==input.confirmPassword)throw new Error('New passwords do not match');this.#validateIdentity({name,username,email,password:input.newPassword});user.passwordHash=hashPassword(input.newPassword);await this.revokeUserSessions(userId,currentSessionId);
    }
    await this.#persistUsers();return this.publicUser(user);
  }
  async listUsers(){return this.users.map((user)=>this.publicUser(user));}
  async createUser(input){
    const value={name:normalize(input.name),username:normalize(input.username),email:normalize(input.email).toLowerCase(),password:input.password};this.#validateIdentity(value);this.#assertUnique(value.username,value.email);
    if(!['administrator','viewer'].includes(input.role))throw new Error('Role is invalid');
    const user={id:`user_${encode(randomBytes(12))}`,name:value.name,username:value.username,email:value.email,passwordHash:hashPassword(value.password),role:input.role,enabled:true,profileImage:null,timeZone:'UTC',dateTimeFormat:'locale',theme:'dark',language:'en',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};this.users.push(user);await this.#persistUsers();return this.publicUser(user);
  }
  async administerUser(id,input,actingUserId){
    const user=this.users.find((item)=>item.id===id);if(!user)throw new Error('User was not found');
    if(input.action==='delete'){if(id===actingUserId)throw new Error('You cannot delete your own account');if(user.role==='administrator'&&this.users.filter((item)=>item.role==='administrator'&&item.enabled).length===1)throw new Error('The last enabled administrator cannot be deleted');this.users=this.users.filter((item)=>item.id!==id);await this.revokeUserSessions(id);await this.#persistUsers();return null;}
    if(input.action==='enable')user.enabled=true;
    else if(input.action==='disable'){if(id===actingUserId)throw new Error('You cannot disable your own account');user.enabled=false;await this.revokeUserSessions(id);}
    else if(input.action==='forceLogout')await this.revokeUserSessions(id);
    else if(input.action==='role'){if(!['administrator','viewer'].includes(input.role))throw new Error('Role is invalid');user.role=input.role;}
    else if(input.action==='resetPassword'){this.#validateIdentity({...user,password:input.password});user.passwordHash=hashPassword(input.password);await this.revokeUserSessions(id);}
    else throw new Error('Administrative action is invalid');
    user.updatedAt=new Date().toISOString();await this.#persistUsers();return this.publicUser(user);
  }
}
