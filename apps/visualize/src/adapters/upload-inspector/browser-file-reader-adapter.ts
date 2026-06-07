import type { UploadInspectorFileReaderPort } from "../../use-cases/upload-inspector/ports";

export function createBrowserFileReaderAdapter(): UploadInspectorFileReaderPort {
  return {
    readAsArrayBuffer(file) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        if (!(file instanceof Blob)) {
          reject(new Error("Could not read file."));

          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result;

          if (result instanceof ArrayBuffer) {
            resolve(result);

            return;
          }

          reject(new Error("Could not read file."));
        };
        reader.onerror = () => reject(new Error("Could not read file."));
        reader.readAsArrayBuffer(file);
      });
    },
  };
}
