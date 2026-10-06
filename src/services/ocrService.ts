import { createWorker } from 'tesseract.js';

export const preprocessImage = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Grayscale and Threshold
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    const val = avg > 128 ? 255 : 0; // Simple threshold
    data[i] = data[i + 1] = data[i + 2] = val;
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas;
};

export const runOCR = async (canvas: HTMLCanvasElement): Promise<string> => {
  const worker = await createWorker('spa');
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789',
    tessedit_pageseg_mode: '7' as any,
  });
  
  const { data: { text } } = await worker.recognize(canvas);
  await worker.terminate();
  
  return text.replace(/[^0-9]/g, '');
};
