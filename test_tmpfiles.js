import fs from 'fs';

async function test() {
  const form = new FormData();
  const buffer = fs.readFileSync('package.json');
  const blob = new Blob([buffer]);
  form.append('file', blob, 'package.json');
  
  const res = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST',
    body: form
  });
  console.log(res.status);
  const data = await res.json();
  console.log(data);
}
test();
