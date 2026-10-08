export const sharedModules=['diet','finance','family'];
export const memberKey=member=>`${member.familyId}:${member.personId}`;
export function sharedPage(modules,requested){return sharedModules.filter(m=>modules.includes(m)).includes(requested)?requested:sharedModules.find(m=>modules.includes(m))||'';}
export function dietSharedData(result){
 const nutrients=['calories','proteinGrams','carbohydrateGrams','fatGrams','fiberGrams'];
 const totals=Object.fromEntries(nutrients.map(n=>[n,result.meals.reduce((sum,m)=>sum+(Number(m.nutrition[n])||0),0)]));
 return {...result,meals:result.meals.map((m,i)=>({...m,id:`shared-${i}`})),totals,overTarget:result.targets?Object.fromEntries(nutrients.map(n=>[n,Math.max(0,totals[n]-result.targets[n])])):null};
}
