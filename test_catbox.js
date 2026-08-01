import fs from 'fs';

async function test() {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  const buffer = fs.readFileSync('package.json');
  const blob = new Blob([buffer]);
  form.append('fileToUpload', blob, 'package.json');
  
  const res = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form
  });
  console.log(res.status);
  const text = await res.text();
  console.log(text);
}
test();
