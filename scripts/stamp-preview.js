import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export const previewBranch=(context,branch)=>context==='branch-deploy'&&branch==='feat/routing-label-private-preview';
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const {CONTEXT,BRANCH,COMMIT_REF}=process.env;
 writeFileSync('src/build-info.js',`export const BUILD = ${JSON.stringify(COMMIT_REF||'dev')};\n`);
 writeFileSync('src/preview-build.js',`export const PREVIEW_BUILD = ${previewBranch(CONTEXT,BRANCH)};\n`);
}
