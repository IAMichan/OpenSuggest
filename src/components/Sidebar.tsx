import React from 'react';
import {
  Settings, Cpu, Zap, Shield, Power, MonitorSmartphone,
  Clock, Layout, Keyboard, BarChart2
} from 'lucide-react';
import { APP_VERSION } from '../constants';

const isDesktop = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isEnabled: boolean;
  onToggle: () => void;
}

const navItems = [
  { id: 'demo', label: 'Playground', icon: Zap },
  { id: 'settings', label: 'General', icon: Settings },
  { id: 'models', label: 'Models & Engine', icon: Cpu },
  { id: 'personalization', label: 'Typing History', icon: Clock },
  { id: 'stats', label: 'Statistics', icon: BarChart2 },
  { id: 'shortcuts', label: 'Key Shortcuts', icon: Keyboard },
  { id: 'privacy', label: 'Privacy & Security', icon: Shield },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, isEnabled, onToggle }) => {
  return (
    <div className="w-[280px] h-full bg-black border-r border-white/5 flex flex-col" id="app-sidebar">
      {/* macOS traffic lights drag zone + logo */}
      <div
        className={`flex flex-col flex-shrink-0 px-6 ${isDesktop && isMac ? 'pt-[52px]' : 'pt-8'}`}
        data-tauri-drag-region
      >
        {/* Logo */}
        <div className="mb-10 pointer-events-none" data-tauri-drag-region>
          <div className="flex items-center gap-3 mb-2" data-tauri-drag-region>
            <div className="w-9 h-9 rounded-xl bg-white shadow-[0_0_20px_rgba(255,255,255,0.12)] flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-black fill-black" />
            </div>
            <h1 className="text-lg font-display font-black tracking-tighter text-white uppercase">
              OpenSuggest
            </h1>
          </div>
          <div className="flex items-center gap-2 ml-0.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-white animate-pulse' : 'bg-white/20'}`}
            />
            <p className="text-[9px] text-white/25 uppercase tracking-[0.4em] font-black">
              v{APP_VERSION}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-6">
        <p className="text-[9px] font-black text-white/15 uppercase tracking-[0.35em] mb-4 ml-3">
          Navigation
        </p>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-100 group ${
                isActive
                  ? 'bg-white text-black'
                  : 'text-white/30 hover:text-white/70 hover:bg-white/[0.04]'
              }`}
            >
              <item.icon
                className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : ''}`}
              />
              <span className="text-xs font-display font-bold uppercase tracking-tight truncate">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Version Info Only */}
      <div className="pt-6 mt-4 border-t border-white/5 px-6 pb-8 flex justify-center">
        <p className="text-[9px] text-white/10 uppercase tracking-[0.4em] font-black">
          v{APP_VERSION}
        </p>
      </div>
    </div>
  );
};
