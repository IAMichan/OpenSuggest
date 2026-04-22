import React from 'react';
import { Settings, Cpu, Terminal, Zap, Shield, HelpCircle, Power, MonitorSmartphone, Clock, Layout, MousePointer2 } from 'lucide-react';
import { motion } from 'motion/react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isEnabled: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, isEnabled, onToggle }) => {
  const items = [
    { id: 'web', label: 'Welcome Page', icon: Layout },
    { id: 'settings', label: 'General Settings', icon: Settings },
    { id: 'models', label: 'Models & Engine', icon: Cpu },
    { id: 'personalization', label: 'Typing History', icon: Clock },
    { id: 'stats', label: 'Inference Stats', icon: Zap },
    { id: 'shortcuts', label: 'Key Shortcuts', icon: Zap },
    { id: 'privacy', label: 'Privacy Hub', icon: Shield },
    { id: 'download', label: 'Download App', icon: MonitorSmartphone },
  ];

  return (
    <div className="w-[300px] h-full bg-black border-r border-white/5 flex flex-col p-10" id="app-sidebar">
      <div className="mb-14">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-white shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center">
            <Zap className="w-6 h-6 text-black fill-black" />
          </div>
          <h1 className="text-2xl font-display font-black tracking-tighter text-white uppercase">Suggest</h1>
        </div>
        <div className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
           <p className="text-[10px] text-white/30 uppercase tracking-[0.4em] font-black">CORE v2.1.0</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5">
        <div className="text-[10px] font-black text-white/10 uppercase tracking-[0.3em] mb-6 ml-4">Terminal Map</div>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-500 group ${
              activeTab === item.id
                ? 'bg-white text-black shadow-[0_20px_40px_-5px_rgba(255,255,255,0.1)] scale-[1.02]'
                : 'text-white/30 hover:bg-white/[0.03] hover:text-white/60'
            }`}
          >
            <item.icon className={`w-5 h-5 transition-transform duration-500 group-hover:scale-110 ${activeTab === item.id ? 'text-black' : 'text-inherit'}`} />
            <span className="text-sm font-display font-bold uppercase tracking-tight">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="pt-10 mt-auto border-t border-white/5">
        <button
          onClick={onToggle}
          className={`w-full p-5 rounded-[24px] border transition-all duration-500 flex items-center justify-between group ${
            isEnabled 
              ? 'bg-white/5 border-white/10 hover:border-white/20' 
              : 'bg-black border-red-500/20 hover:border-red-500/40 opacity-50'
          }`}
        >
          <div className="flex flex-col items-start text-left">
            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-1.5">Status</span>
            <span className={`text-xs font-display font-black uppercase tracking-widest ${isEnabled ? 'text-white' : 'text-red-500'}`}>
              {isEnabled ? 'Core Active' : 'Offline'}
            </span>
          </div>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-500 ${
            isEnabled 
              ? 'bg-white text-black shadow-lg shadow-white/5' 
              : 'bg-red-500/10 text-red-500'
          }`}>
            <Power className="w-5 h-5" />
          </div>
        </button>
      </div>
    </div>
  );
};
