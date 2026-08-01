import fs from 'fs';
let code = fs.readFileSync('src/components/ChatWindow.tsx', 'utf8');

const regexFileUpload = /const handleFileUpload = async \(e: React\.ChangeEvent<HTMLInputElement>, type: 'image' \| 'file'\) => \{([\s\S]*?)\} finally \{/g;

const replacementFileUpload = `const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setShowAttachmentMenu(false);

      let finalUrl = '';
      
      setUploadMethod('GoFile');
      const path = \`chats/\${chatId}/\${Date.now()}_\${file.name}\`;
      finalUrl = await chatService.uploadFile(path, file, (progress) => {
        setUploadProgress(Math.round(progress));
      });

      let thumbnail = undefined;
      if (type === 'image') {
        try {
          thumbnail = await generateThumbnail(file);
        } catch (e) {
          console.error('Failed to generate thumbnail', e);
        }
      }

      await chatService.sendMessage(
        chatId, 
        user.uid, 
        getUserDisplayName(profile as UserProfile) || user.displayName || 'Anonymous', 
        { 
          type, 
          url: finalUrl,
          thumbnail,
          fileName: file.name, 
          fileSize: file.size 
        }
      );
    } catch (error: any) {
      console.error('File upload failed:', error);
      alert(error.message || 'Ошибка при загрузке файла');
    } finally {`;

code = code.replace(regexFileUpload, replacementFileUpload);

fs.writeFileSync('src/components/ChatWindow.tsx', code);
