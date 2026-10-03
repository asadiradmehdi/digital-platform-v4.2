import fs from 'node:fs';
const matrix=JSON.parse(fs.readFileSync(new URL('./route-matrix.json',import.meta.url)));
if(!matrix.routes.length || !matrix.viewports.length) throw new Error('Visual route matrix is empty');
console.log(`Visual matrix OK: ${matrix.routes.length} routes × ${matrix.viewports.length} viewports × ${matrix.states.length} states`);
