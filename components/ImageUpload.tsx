"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface ImageFile {
  id: string;
  file: File;
  preview: string;
  uploading?: boolean;
  uploaded?: boolean;
  error?: string;
}

interface ImageUploadProps {
  images: ImageFile[];
  onChange: (images: ImageFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  disabled?: boolean;
  acceptPdf?: boolean; // Permitir archivos PDF además de imágenes
}

export type { ImageFile };

export default function ImageUpload({
  images,
  onChange,
  maxFiles = 10,
  maxSizeMB = 3,
  disabled = false,
  acceptPdf = false,
}: ImageUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ref para mantener siempre la versión más reciente de images (evita stale closure)
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const processFiles = useCallback((files: FileList | null) => {
    if (!files || disabled) return;

    setErrorMsg(null);
    const currentImages = imagesRef.current;
    const newImages: ImageFile[] = [];
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const rechazados: string[] = [];

    Array.from(files).forEach((file) => {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";

      if (!isImage && !(acceptPdf && isPdf)) {
        rechazados.push(`"${file.name}": tipo no permitido (solo ${acceptPdf ? "imagenes o PDF" : "imagenes"})`);
        return;
      }

      if (file.size > maxSizeBytes) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(1);
        rechazados.push(`"${file.name}": pesa ${sizeMB} MB (maximo ${maxSizeMB} MB)`);
        return;
      }

      if (currentImages.length + newImages.length >= maxFiles) {
        rechazados.push(`"${file.name}": ya tienes el maximo de ${maxFiles} archivos`);
        return;
      }

      newImages.push({
        id: generateId(),
        file,
        preview: isImage ? URL.createObjectURL(file) : "",
      });
    });

    if (rechazados.length > 0) {
      setErrorMsg(rechazados.join(". "));
    }

    if (newImages.length > 0) {
      onChange([...currentImages, ...newImages]);
    }
  }, [onChange, maxFiles, maxSizeMB, disabled, acceptPdf]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    // Reset input para permitir seleccionar el mismo archivo
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [processFiles]);

  const removeImage = useCallback((id: string) => {
    const imageToRemove = images.find((img) => img.id === id);
    if (imageToRemove) {
      URL.revokeObjectURL(imageToRemove.preview);
    }
    onChange(images.filter((img) => img.id !== id));
  }, [images, onChange]);

  const openFileDialog = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  return (
    <div className="space-y-4">
      {/* Zona de drop */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptPdf ? "image/*,application/pdf" : "image/*"}
          multiple
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
        />

        <div className="space-y-2">
          <div className="text-4xl">{acceptPdf ? "📷📄" : "📷"}</div>
          <p className="text-gray-600">
            {dragActive
              ? `Suelta ${acceptPdf ? "los archivos" : "las imágenes"} aquí`
              : `Arrastra ${acceptPdf ? "imágenes o PDFs" : "imágenes"} o haz clic para seleccionar`
            }
          </p>
          <p className="text-xs text-gray-500">
            Máximo {maxFiles} {acceptPdf ? "archivos" : "imágenes"}, {maxSizeMB}MB cada uno
          </p>
        </div>
      </div>

      {/* Mensaje de error cuando se rechazan archivos */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      {/* Preview de archivos */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((img) => {
            const isPdf = img.file.type === "application/pdf";
            return (
            <div key={img.id} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                {isPdf ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-red-50">
                    <span className="text-4xl">📄</span>
                    <span className="text-xs text-red-600 font-medium mt-1">PDF</span>
                  </div>
                ) : (
                  <img
                    src={img.preview}
                    alt={img.file.name}
                    className="w-full h-full object-cover"
                  />
                )}
                
                {/* Overlay de estado */}
                {img.uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
                
                {img.uploaded && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                
                {img.error && (
                  <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
                    <span className="text-white text-xs px-2 text-center">{img.error}</span>
                  </div>
                )}
              </div>
              
              {/* Botón eliminar */}
              {!img.uploading && !disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(img.id);
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              
              {/* Nombre del archivo */}
              <p className="text-xs text-gray-500 mt-1 truncate" title={img.file.name}>
                {img.file.name}
              </p>
            </div>
          );
          })}
        </div>
      )}

      {/* Contador */}
      {images.length > 0 && (
        <p className="text-sm text-gray-500 text-right">
          {images.length} / {maxFiles} {acceptPdf ? "archivos" : "imágenes"}
        </p>
      )}
    </div>
  );
}
