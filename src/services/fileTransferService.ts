import { collection, doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

class FileTransferService {
  private peers = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  
  async initiateTransfer(chatId: string, senderId: string, receiverId: string, file: File, onProgress: (progress: number) => void): Promise<string> {
    const transferId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peers.set(transferId, pc);
    
    const dc = pc.createDataChannel('fileTransfer', { ordered: true });
    this.dataChannels.set(transferId, dc);
    
    const transferDoc = doc(db, `chats/${chatId}/transfers`, transferId);
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') resolve();
        else pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') resolve();
        };
        setTimeout(resolve, 1500);
    });

    await setDoc(transferDoc, {
      senderId,
      receiverId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      offer: JSON.stringify(pc.localDescription),
      status: 'offered',
      timestamp: serverTimestamp()
    });

    return new Promise((resolve, reject) => {
      const unsubscribe = onSnapshot(transferDoc, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;
        
        if (data.status === 'answered' && data.answer) {
          unsubscribe();
          await pc.setRemoteDescription(JSON.parse(data.answer));
          
          if (dc.readyState === 'open') {
             this.sendFile(dc, file, onProgress).then(() => resolve('sent')).catch(reject);
          } else {
             dc.onopen = () => {
                this.sendFile(dc, file, onProgress).then(() => resolve('sent')).catch(reject);
             };
          }
        } else if (data.status === 'rejected') {
          unsubscribe();
          reject(new Error('Отправка отменена или не удалась'));
        }
      }, (error) => {
        unsubscribe();
        reject(error);
      });
    });
  }

  private async sendFile(dc: RTCDataChannel, file: File, onProgress: (progress: number) => void) {
    const chunkSize = 16384; 
    const fileReader = new FileReader();
    let offset = 0;

    return new Promise<void>((resolve, reject) => {
      fileReader.onerror = error => reject(error);
      fileReader.onabort = () => reject(new Error('File reading aborted'));
      
      fileReader.onload = e => {
        if (!e.target?.result) return;
        const buffer = e.target.result as ArrayBuffer;
        
        const sendNext = () => {
          if (dc.bufferedAmount > dc.bufferedAmountLowThreshold) {
             dc.onbufferedamountlow = () => {
               dc.onbufferedamountlow = null;
               sendNext();
             };
             return;
          }
          
          dc.send(buffer);
          offset += buffer.byteLength;
          onProgress(Math.min((offset / file.size) * 100, 100));
          
          if (offset < file.size) {
            readSlice(offset);
          } else {
             dc.send(JSON.stringify({ type: 'EOF' }));
             resolve();
          }
        };
        sendNext();
      };
      
      const readSlice = (o: number) => {
        const slice = file.slice(offset, o + chunkSize);
        fileReader.readAsArrayBuffer(slice);
      };
      
      dc.send(JSON.stringify({ type: 'meta', name: file.name, size: file.size, mimeType: file.type }));
      dc.bufferedAmountLowThreshold = 65535;
      readSlice(0);
    });
  }

  subscribeToIncomingTransfers(chatId: string, receiverId: string, onIncoming: (transferId: string, meta: any) => void) {
    const transfersRef = collection(db, `chats/${chatId}/transfers`);
    return onSnapshot(transfersRef, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.status === 'offered' && data.receiverId === receiverId) {
             onIncoming(change.doc.id, data);
          }
        }
      });
    }, (error) => {
      console.warn("Transfer listener error:", error);
    });
  }

  async acceptTransfer(chatId: string, transferId: string, offerString: string, onProgress: (p: number) => void, onComplete: (url: string, name: string) => void) {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peers.set(transferId, pc);
    
    let receivedBuffers: ArrayBuffer[] = [];
    let receivedBytes = 0;
    let expectedSize = 0;
    let fileName = 'file';
    let mimeType = '';
    
    pc.ondatachannel = (event) => {
      const dc = event.channel;
      dc.binaryType = 'arraybuffer';
      
      dc.onmessage = (e) => {
        if (typeof e.data === 'string') {
           const msg = JSON.parse(e.data);
           if (msg.type === 'meta') {
             expectedSize = msg.size;
             fileName = msg.name;
             mimeType = msg.mimeType;
           } else if (msg.type === 'EOF') {
             const blob = new Blob(receivedBuffers, { type: mimeType });
             const url = URL.createObjectURL(blob);
             onComplete(url, fileName);
             dc.close();
           }
        } else {
           receivedBuffers.push(e.data);
           receivedBytes += e.data.byteLength;
           if (expectedSize > 0) {
              onProgress(Math.min((receivedBytes / expectedSize) * 100, 100));
           }
        }
      };
    };
    
    await pc.setRemoteDescription(JSON.parse(offerString));
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') resolve();
        else pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') resolve();
        };
        setTimeout(resolve, 1500);
    });
    
    const transferDoc = doc(db, `chats/${chatId}/transfers`, transferId);
    await updateDoc(transferDoc, {
       answer: JSON.stringify(pc.localDescription),
       status: 'answered'
    });
  }
}

export const fileTransferService = new FileTransferService();
