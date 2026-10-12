const fs = require('node:fs');
const xml = fs.readFileSync(process.argv[2], 'utf8');
const re = /text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
let m;
while ((m = re.exec(xml))) {
  if (m[1]) console.log(`${m[1]}\t${m[2]},${m[3]}-${m[4]},${m[5]}`);
}
