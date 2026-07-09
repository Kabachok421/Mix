const serverInfo = await fetch('https://api.gofile.io/servers').then(res => res.json());
const server = serverInfo.data.servers[0].name;

const formData = new FormData();
const blob = new Blob(['Hello World!'], { type: 'text/plain' });
formData.append('file', blob, 'test.txt');

const upload = await fetch(`https://${server}.gofile.io/contents/uploadfile`, {
  method: 'POST',
  body: formData
}).then(res => res.json());

console.log(upload);
const guestToken = upload.data.guestToken;
const folderId = upload.data.parentFolder;

const content = await fetch(`https://api.gofile.io/contents/${folderId}?wt=${guestToken}`, {
  headers: {
    'Authorization': `Bearer ${guestToken}`
  }
}).then(res => res.json());
console.log(content);
