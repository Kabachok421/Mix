import fs from 'fs';
let code = fs.readFileSync('src/services/chatService.ts', 'utf8');

const regexSendMessage = /const messageData = \{([\s\S]*?)type: data.type \|\| 'text'([\s\S]*?)\};/g;

const replacementSendMessage = `const messageData: any = {
        senderId,
        senderName,
        timestamp,
        type: data.type || 'text'
      };
      
      if (data.text) messageData.text = data.text;
      if (data.url) messageData.url = data.url;
      if (data.thumbnail) messageData.thumbnail = data.thumbnail;
      if (data.fileName) messageData.fileName = data.fileName;
      if (data.fileSize) messageData.fileSize = data.fileSize;
      if (data.duration) messageData.duration = data.duration;`;

code = code.replace(regexSendMessage, replacementSendMessage);

fs.writeFileSync('src/services/chatService.ts', code);
