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
    headers: {
      'Origin': 'https://ais-dev-nkxryub32aikrso5yv6dow-578999313129.europe-west2.run.app'
    },
    body: form
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log(text);
}
test();
