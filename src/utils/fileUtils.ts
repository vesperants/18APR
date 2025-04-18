/**
 * File Utilities
 *
 * Contains helper functions for file processing.
 */

// Define the structure for file payloads expected by the API
interface FilePayload {
  data: string; // Base64 encoded string
  mimeType: string;
}

/**
 * Reads a File object and converts it to a base64 encoded string with its MIME type.
 *
 * @param file The File object to read.
 * @returns A Promise resolving to a FilePayload object.
 * @throws Will reject if the file reading fails.
 */
export const readFileAsBase64 = (file: File): Promise<FilePayload> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Result is Data URL (e.g., data:image/jpeg;base64,ABC...), extract base64 part
      const base64String = (reader.result as string)?.split(',')[1];
      if (base64String) {
        resolve({ data: base64String, mimeType: file.type });
      } else {
        reject(new Error(`Failed to read file ${file.name}: Invalid data URL format.`));
      }
    };
    reader.onerror = (error) => reject(new Error(`Failed to read file ${file.name}: ${error}`));
    reader.readAsDataURL(file); // Read as Data URL
  });
}; 