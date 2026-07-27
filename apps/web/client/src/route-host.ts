export function createRouteHost(container:Element,id:string){
  const host=document.createElement('div');
  host.id=id;
  container.replaceChildren(host);
  return host;
}

export function createModalRouteHost(id:string,className:string){
  const host=document.createElement('div');
  host.id=id;
  host.className=className;
  document.body.append(host);
  return host;
}
