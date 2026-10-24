import type { Need, Role } from './needTypes';
export function reportNeeds(needs:Need[],filters:Record<string,string>,role:Role) {
  // Input already contains only the selected period and the caller's authorized scope.
  if(role!=='admin')return needs;
  return needs.filter(n=>(['type','factor','status','area','department','occupational_group'] as const).every(key=>!filters[key]||n[key]===filters[key]));
}
