import fs from 'fs';
let code = fs.readFileSync('src/components/FileMessage.tsx', 'utf8');

code = code.replace(
  /<motion\.img\s+initial=\{\{ scale: 0\.9/g,
  `{imageSrc ? (
                  <motion.img 
                    initial={{ scale: 0.9`
);

code = code.replace(
  /onClick=\{\(e\) => e\.stopPropagation\(\)\}\s*\/>/g,
  `onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="text-white p-4 bg-black/50 rounded-lg">Изображение недоступно</div>
                )}`
);

fs.writeFileSync('src/components/FileMessage.tsx', code);
