import type {ReactNode} from 'react';

export function RouteLoading({children,route=false}:{children:ReactNode;route?:boolean}){
  return <div className={`panel skeleton${route?' react-route-loading':''}`}>{children}</div>;
}

export function RouteError({title,message,onRetry,panel=false}:{title:string;message:string;onRetry?:()=>void;panel?:boolean}){
  return <div className={`${panel?'panel':'empty'} error-state`}><h2>{title}</h2><p>{message}</p>{onRetry?<button className="secondary" onClick={onRetry}>Try again</button>:null}</div>;
}
