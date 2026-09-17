// Tavern Helper exposes SillyTavern inside its hidden script iframe as well.
// Prefer accessible ancestors with the real chat surface, never the first API alias.
export function resolveTavernHost(source) {
  let candidate=source,best=null;
  const seen=new Set();
  for(let depth=0;candidate&&depth<8&&!seen.has(candidate);depth++) {
    seen.add(candidate);
    try {
      if(candidate.document?.body&&candidate.SillyTavern?.getContext) {
        best=candidate;
        if(candidate.document.querySelector?.('#chat'))return candidate;
      }
      const parent=candidate.parent;
      if(!parent||parent===candidate)break;
      candidate=parent;
    }catch{break;}
  }
  return best||source;
}
