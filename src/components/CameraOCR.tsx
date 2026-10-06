import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { preprocessImage, runOCR } from '../services/ocrService';
import { resizeAndCompressImage } from '../utils/imageProcessor';
import { useCamera } from '../hooks/useCamera';

interface CameraOCRProps {
  onResult: (value: string, image: Blob) => void;
  onClose: () => void;
  recentImage?: Blob | null;
}

export default function CameraOCR({ onResult, onClose, recentImage }: CameraOCRProps) {
  const { videoRef, startCamera, stopCamera, stream } = useCamera();
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionState, setDetectionState] = useState<'searching' | 'detected'>('searching');
  const [detectedNumber, setDetectedNumber] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const handleFile = async (file: File) => {
    setIsProcessing(true);
    try {
      const compressedBlob = await resizeAndCompressImage(file);
      const img = new Image();
      img.src = URL.createObjectURL(compressedBlob);
      await img.decode();
      
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      
      const text = await runOCR(preprocessImage(canvas));
      onResult(text.replace(/[^0-9]/g, ''), compressedBlob);
      onClose();
    } catch (err) {
      console.error(err);
      alert('No se pudo procesar la imagen');
    } finally {
      setIsProcessing(false);
    }
  };

  const capture = async () => {
    if (!videoRef.current || !frameRef.current) return;
    
    setIsProcessing(true);
    try {
      const video = videoRef.current;
      const frame = frameRef.current;
      
      const videoRect = video.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      
      const scaleX = video.videoWidth / videoRect.width;
      const scaleY = video.videoHeight / videoRect.height;
      
      const cropX = (frameRect.left - videoRect.left) * scaleX;
      const cropY = (frameRect.top - videoRect.top) * scaleY;
      const cropWidth = frameRect.width * scaleX;
      const cropHeight = frameRect.height * scaleY;
      
      const canvas = document.createElement("canvas");
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");
      
      ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      
      canvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error("Error creating blob");
        }
        const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
        await handleFile(file);
      }, "image/jpeg", 0.6);
    } catch (err) {
      console.error("Capture error:", err);
      alert("No se pudo capturar la imagen");
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="relative flex-1 bg-zinc-900">
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        <div ref={frameRef} className={cn(
          "absolute inset-0 m-auto w-[80%] h-[20%] border-2 rounded-2xl transition-colors duration-300",
          detectionState === 'searching' ? "border-yellow-400" : "border-green-500"
        )}>
           <div className="absolute -top-8 left-0 right-0 text-center text-xs font-bold text-white">
             {detectionState === 'searching' ? "Buscando números..." : "Números detectados"}
           </div>
        </div>
      </div>

      <div className="bg-zinc-950 p-6 flex items-center justify-between border-t border-white/10">
        <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="flex flex-col items-center gap-2 text-zinc-400 disabled:opacity-50">
          <Upload className="w-6 h-6" />
          <span className="text-[10px]">Galería</span>
        </button>
        <button onClick={capture} disabled={isProcessing} className="w-16 h-16 rounded-full bg-white flex items-center justify-center disabled:opacity-50">
          {isProcessing ? <RefreshCw className="animate-spin" /> : <div className="w-12 h-12 rounded-full bg-zinc-900" />}
        </button>
        <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden">
          {recentImage && <img src={URL.createObjectURL(recentImage)} className="w-full h-full object-cover" />}
        </div>
      </div>
      <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
    </div>
  );
}
