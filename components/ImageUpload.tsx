"use client";

import { useState, useRef, useCallback } from "react";

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
  maxSizeMB = 5,
  disabled = false,
  acceptPdf = false,
}: ImageUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const processFiles = useCallback((files: FileList | null) => {
    if (!files || disabled) return;

    const newImages: ImageFile[] = [];
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    Array.from(files).forEach((file) => {
      // Validar tipo
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";

      if (!isImage && !(acceptPdf && isPdf)) {
        console.warn(`Archivo ignorado (tipo no permitido): ${file.name}`);
        return;
      }

      // Validar tamaño
      if (file.size > maxSizeBytes) {
        console.warn(`Archivo muy grande (max ${maxSizeMB}MB): ${file.name}`);
        return;
      }

      // Validar cantidad máxima
      if (images.length + newImages.length >= maxFiles) {
        console.warn(`Máximo ${maxFiles} archivos permitidos`);
        return;
      }

      newImages.push({
        id: generateId(),
        file,
        preview: isImage ? URL.createObjectURL(file) : "", // PDFs no tienen preview de imagen
      });
    });

    if (newImages.length > 0) {
      onChange([...images, ...newImages]);
    }
  }, [images, onChange, maxFiles, maxSizeMB, disabled]);

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
