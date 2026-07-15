import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadString } from 'firebase/storage';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const storage = getStorage(app);
const testRef = ref(storage, 'test.txt');

uploadString(testRef, 'Hello, world!').then(() => {
  console.log('Storage upload successful');
  process.exit(0);
}).catch((error) => {
  console.error('Storage upload failed', error);
  process.exit(1);
});
