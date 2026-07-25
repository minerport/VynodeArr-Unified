import { Component,type ErrorInfo,type ReactNode } from 'react';

export class RouteErrorBoundary extends Component<{children:ReactNode},{error:string}>{
  state={error:''};
  static getDerivedStateFromError(error:unknown){return{error:error instanceof Error?error.message:'This page could not be displayed.'};}
  componentDidCatch(error:Error,info:ErrorInfo){console.error('React route failed',error,info);}
  render(){
    return this.state.error
      ?<div className="empty error-state"><h2>Something went wrong</h2><p>{this.state.error}</p><button className="secondary" onClick={()=>location.reload()}>Reload VynodeArr</button></div>
      :this.props.children;
  }
}
