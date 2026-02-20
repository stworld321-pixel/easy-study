import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, X, Loader2, Check, AlertCircle } from 'lucide-react';
import { uploadAPI } from '../services/api';

interface ImageUploadProps {
  currentImage?: string | null;
  onUploadSuccess: (url: string) => void;
  type?: 'avatar' | 'tutor';
  className?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  currentImage,
  onUploadSuccess,
  type = 'avatar',
  className = '',
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Invalid file type. Please upload JPG, PNG, GIF, or WebP.' });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File too large. Maximum size is 5MB.' });
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    setMessage(null);

    try {
      const response = type === 'tutor'
        ? await uploadAPI.uploadTutorImage(file)
        : await uploadAPI.uploadAvatar(file);

      if (response.success) {
        setMessage({ type: 'success', text: 'Image uploaded successfully!' });
        onUploadSuccess(response.url);
        setPreviewUrl(null);
      } else {
        setMessage({ type: 'error', text: 'Upload failed. Please try again.' });
        setPreviewUrl(null);
      }
    } catch (error: unknown) {
      console.error('Upload error:', error);
      const axiosError = error as { response?: { data?: { detail?: string } } };
      setMessage({
        type: 'error',
        text: axiosError?.response?.data?.detail || 'Upload failed. Please try again.',
      });
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const displayImage = previewUrl || currentImage;

  return (
    <div className={`relative ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleChange}
        className="hidden"
      />

      {/* Upload area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`relative cursor-pointer transition-all duration-300 ${
          dragActive ? 'scale-105' : ''
        }`}
      >
        {/* Image preview or placeholder */}
        <div
          className={`relative w-32 h-32 rounded-2xl overflow-hidden border-2 border-dashed transition-colors ${
            dragActive
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-primary-400 bg-gray-50'
          }`}
        >
          {displayImage ? (
            <img
              src={displayImage}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
              <Camera className="w-8 h-8 mb-2" />
              <span className="text-xs text-center px-2">Drop image or click</span>
            </div>
          )}

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
            {uploading ? (
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            ) : (
              <div className="text-white text-center">
                <Upload className="w-6 h-6 mx-auto mb-1" />
                <span className="text-xs">Change</span>
              </div>
            )}
          </div>
        </div>

        {/* Upload progress indicator */}
        {uploading && (
          <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary-500"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 2, ease: 'linear' }}
            />
          </div>
        )}
      </div>

      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={`absolute top-full left-0 right-0 mt-2 p-2 rounded-lg text-xs flex items-center gap-1 ${
              message.type === 'success'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="w-3 h-3" />
            ) : (
              <AlertCircle className="w-3 h-3" />
            )}
            <span>{message.text}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMessage(null);
              }}
              className="ml-auto"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help text */}
      <p className="text-xs text-gray-500 mt-2 text-center">
        JPG, PNG, GIF, WebP (max 5MB)
      </p>
    </div>
  );
};

export default ImageUpload;
