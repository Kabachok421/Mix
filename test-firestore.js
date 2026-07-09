import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

// Need to run this in browser context or with a node wrapper that has user credentials.
