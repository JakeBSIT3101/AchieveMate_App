import { createWorker } from 'tesseract.js';

/**
 * Run OCR locally on an image file
 * @param {string} fileUri - URI of the image
 * @param {function} onProgress - optional progress callback
 * @returns {Promise<string>} - extracted text
 */
export const runOCR = async (fileUri, onProgress) => {
  const worker = createWorker({
    logger: onProgress || (() => {}),
  });

  try {
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    const { data } = await worker.recognize(fileUri);
    return data.text;
  } catch (err) {
    console.error("OCR failed:", err);
    throw err;
  } finally {
    await worker.terminate();
  }
};