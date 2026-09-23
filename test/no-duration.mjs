// Tom 23.9 18:51: partner finding has no duration question any more. Old scripted flows still tap "duration:X" after the time;
// this wrapper turns such a tap into "no new message" (returns the previous reply), so the flows test what the user now sees.
export const noDur = f => { let last; return async o => { if (o?.actionId?.startsWith("duration:")) return last; last = await f(o); return last; }; };
