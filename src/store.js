export function memoryStore(){const memory=new Map();return{
 async get(key){return memory.get(key)??null;},
 async set(key,value){memory.set(key,structuredClone(value));},
 async list(prefix=""){return[...memory.entries()].filter(([k])=>k.startsWith(prefix)).map(([key,value])=>({key,value:structuredClone(value)}));},
 async delete(key){memory.delete(key);}
};}
export function netlifyStore(store){return{
 async get(key){return store.get(key,{type:"json"});},
 async set(key,value){await store.setJSON(key,value);},
 async list(prefix=""){
  const out=await store.list({prefix}),rows=[];
  for(const blob of out.blobs)rows.push({key:blob.key,value:await store.get(blob.key,{type:"json"})});
  return rows;
 },
 async delete(key){await store.delete(key);}
};}
