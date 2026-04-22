import React from 'react';
import { AppStatus } from '../types';
import { motion } from 'motion/react';

interface StatusIndicatorProps {
  status: AppStatus;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  const config = {
    ready: { color: 'bg-[#4ade80]', text: 'Ollama Connected', badge: 'status-badge-green' },
    loading: { color: 'bg-blue-500', text: 'Connecting...', badge: 'status-badge-green text-blue-400 bg-blue-400/10 border-blue-400/20' },
    error: { color: 'bg-red-500', text: 'Engine Offline', badge: 'status-badge-green text-red-500 bg-red-500/10 border-red-500/20' },
    paused: { color: 'bg-gray-500', text: 'System Paused', badge: 'status-badge-green text-white/40 bg-white/5 border-white/10' },
  };

  const current = config[status];

  return (
    <div className={current.badge} id="status-indicator">
      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
        className={`w-1.5 h-1.5 rounded-full ${current.color}`}
      />
      {current.text}
    </div>
  );
};
