import { useAuth } from '../hooks/useAuth';
import { motion } from 'motion/react';
import { LogIn, MessageSquare } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] dark:bg-[#0a0a0a] p-4 transition-colors duration-500">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-md w-full bg-white dark:bg-[#141414] rounded-[32px] p-12 shadow-[0_4px_30px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_40px_rgba(0,0,0,0.4)] border border-[#e5e5e0] dark:border-[#222] text-center"
      >
        <div className="w-20 h-20 bg-[#5A5A40] dark:bg-[#3d3d2b] rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg">
          <MessageSquare className="w-10 h-10 text-white" />
        </div>
        
        <h1 className="text-4xl font-serif font-light text-[#1a1a1a] dark:text-white mb-2">Mix</h1>
        <p className="text-[#5A5A40] dark:text-[#A0A080] font-light mb-8 italic">Связь в новом измерении</p>
        
        <button
          onClick={login}
          className="w-full flex items-center justify-center gap-3 bg-[#1a1a1a] text-white py-4 rounded-full font-medium hover:bg-[#333] transition-colors shadow-md group"
        >
          <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          Войти через Google
        </button>
        
        <p className="mt-8 text-xs text-[#999] uppercase tracking-widest font-sans">
          Безопасно. Быстро. Просто.
        </p>
      </motion.div>
    </div>
  );
}
