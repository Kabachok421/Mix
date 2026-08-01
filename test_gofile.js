import fs from 'fs';

async function test() {
  const serverRes = await fetch('https://api.gofile.io/servers');
  const serverData = await serverRes.json();
  const server = serverData.data.servers[0].name;
  
  const form = new FormData();
  const buffer = fs.readFileSync('package.json');
  const blob = new Blob([buffer]);
  form.append('file', blob, 'package.json');
  
  const res = await fetch(`https://${server}.gofile.io/contents/uploadfile`, {
    method: 'POST',
    body: form
  });
  const text = await res.text();
  console.log(text);
}
test();
