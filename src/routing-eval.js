// Allowlisted, content-free telemetry. It must never receive a user handle, message or model output.
const ROUTES=new Set(['availability','public_board','player_search','unknown','other']);
const SOURCES=new Set(['explicit','active_state','rule','fallback','other']);
export function routingEvent({venue,route}){
 const chosen=ROUTES.has(route?.chosen)?route.chosen:'other',source=SOURCES.has(route?.source)?route.source:'other';
 return {event:'routing_decision',club:['gt','saar','smash'].includes(venue?.key)?venue.key:'unknown',route:chosen,source,clarification:chosen==='unknown'};
}
export const LABELS=Object.freeze(['availability','public_board','player_search','unknown','other']);
export function scoreRoutes(rows){
 const tally=Object.fromEntries(LABELS.map(x=>[x,{n:0,correct:0,misses:Object.fromEntries(LABELS.map(y=>[y,0]))}]));
 for(const {label,predicted} of rows){if(!tally[label]||!tally[predicted])throw Error('invalid route label');const x=tally[label];x.n++;x.misses[predicted]++;if(label===predicted)x.correct++;}
 const n=rows.length,correct=rows.filter(x=>x.label===x.predicted).length;
 return {n,correct,accuracy:n?correct/n:null,byRoute:tally};
}
