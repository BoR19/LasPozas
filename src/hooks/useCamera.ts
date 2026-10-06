import { useState, useEffect, useRef, useCallback } from 'react';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const isInitializingRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(track => track.stop());
      activeStreamRef.current = null;
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (isInitializingRef.current || activeStreamRef.current) return;
    
    isInitializingRef.current = true;
    setIsInitializing(true);
    setError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Cámara no soportada en este navegador');
      }

      const constraints = {
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      activeStreamRef.current = newStream;
      setStream(newStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        // Ensure video plays
        try {
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            await playPromise;
          }
        } catch (playErr) {
          if (playErr instanceof Error && playErr.name !== 'AbortError') {
            console.error('Video play error:', playErr);
          }
        }
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('No se pudo abrir la cámara. Verifique los permisos o use la opción alternativa.');
    } finally {
      isInitializingRef.current = false;
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return { videoRef, startCamera, stopCamera, stream, error, isInitializing };
}
