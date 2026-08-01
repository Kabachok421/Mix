import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const storage = getStorage(app);

async function run() {
  try {
    const storageRef = ref(storage, 'test.txt');
    await uploadString(storageRef, 'hello world');
    const url = await getDownloadURL(storageRef);
    console.log('Success:', url);
  } catch(e) {
    console.error('Error:', e.message);
  }
}
run();
