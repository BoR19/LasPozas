import React from 'react';
import { Droplets } from 'lucide-react';

export default function MobileTopBar() {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-zinc-200 flex items-center px-4 z-40 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-blue-600 rounded-lg text-white">
          <Droplets className="w-5 h-5" />
        </div>
        <h1 className="font-black text-zinc-900 text-lg tracking-tight">AquaLectura</h1>
      </div>
    </header>
  );
}
