import fs from 'fs';
let code = fs.readFileSync('src/components/ChatWindow.tsx', 'utf8');

const regexVoiceUpload = /const handleVoiceSend = async \(\) => \{([\s\S]*?)\} finally \{/g;

const replacementVoiceUpload = `const handleVoiceSend = async () => {
    const recording = await stopRecording();
    if (!recording || !user) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      let finalUrl = '';
      const fileName = \`voice_\${Date.now()}.webm\`;
      
      setUploadMethod('GoFile');
      const path = \`chats/\${chatId}/\${fileName}\`;
      finalUrl = await chatService.uploadFile(path, recording.blob, (progress) => {
        setUploadProgress(Math.round(progress));
      });

      await chatService.sendMessage(
        chatId, 
        user.uid, 
        getUserDisplayName(profile as UserProfile) || user.displayName || 'Anonymous', 
        { 
          type: 'voice', 
          url: finalUrl, 
          fileName,
          duration: recording.duration 
        }
      );
    } catch (error: any) {
      alert(error.message || 'Ошибка при отправке голосового сообщения');
    } finally {`;

code = code.replace(regexVoiceUpload, replacementVoiceUpload);

fs.writeFileSync('src/components/ChatWindow.tsx', code);
