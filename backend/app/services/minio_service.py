"""
MinIO Service - Object Storage for Images

Handles image upload, retrieval, and deletion for tutor profiles.
"""

import io
import uuid
from datetime import timedelta
from typing import Optional, Tuple
from minio import Minio
from minio.error import S3Error
from app.core.config import settings


class MinIOService:
    """Service for managing image storage with MinIO"""

    def __init__(self):
        self.client: Optional[Minio] = None
        self.bucket = settings.MINIO_BUCKET
        self._initialized = False

    def _ensure_initialized(self):
        """Lazy initialization of MinIO client"""
        if self._initialized:
            return

        self._initialized = True
        try:
            self.client = Minio(
                settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_SECURE
            )

            # Ensure bucket exists
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
                print(f"Created MinIO bucket: {self.bucket}")

            print(f"MinIO service initialized successfully")
        except Exception as e:
            print(f"Failed to initialize MinIO service: {e}")
            self.client = None

    def _get_content_type(self, filename: str) -> str:
        """Get content type based on file extension"""
        ext = filename.lower().split('.')[-1] if '.' in filename else ''
        content_types = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
        }
        return content_types.get(ext, 'application/octet-stream')

    def _validate_image(self, filename: str, file_size: int) -> Tuple[bool, str]:
        """Validate image file"""
        # Check file extension
        allowed_extensions = {'jpg', 'jpeg', 'png', 'gif', 'webp'}
        ext = filename.lower().split('.')[-1] if '.' in filename else ''

        if ext not in allowed_extensions:
            return False, f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"

        # Check file size (max 5MB)
        max_size = 5 * 1024 * 1024  # 5MB
        if file_size > max_size:
            return False, f"File too large. Maximum size: 5MB"

        return True, ""

    def upload_image(
        self,
        file_data: bytes,
        filename: str,
        folder: str = "avatars"
    ) -> Optional[dict]:
        """
        Upload an image to MinIO

        Args:
            file_data: Image file bytes
            filename: Original filename
            folder: Folder/prefix for organizing images (e.g., 'avatars', 'documents')

        Returns:
            Dictionary with image URL and object name, or None if failed
        """
        self._ensure_initialized()
        if not self.client:
            return None

        # Validate image
        is_valid, error_msg = self._validate_image(filename, len(file_data))
        if not is_valid:
            return {"error": error_msg}

        try:
            # Generate unique filename
            ext = filename.lower().split('.')[-1] if '.' in filename else 'jpg'
            unique_name = f"{folder}/{uuid.uuid4().hex}.{ext}"

            # Get content type
            content_type = self._get_content_type(filename)

            # Upload to MinIO
            self.client.put_object(
                self.bucket,
                unique_name,
                io.BytesIO(file_data),
                length=len(file_data),
                content_type=content_type
            )

            # Generate public URL
            if settings.MINIO_PUBLIC_URL:
                url = f"{settings.MINIO_PUBLIC_URL}/{self.bucket}/{unique_name}"
            else:
                # Use internal URL format
                protocol = "https" if settings.MINIO_SECURE else "http"
                url = f"{protocol}://{settings.MINIO_ENDPOINT}/{self.bucket}/{unique_name}"

            print(f"Uploaded image: {unique_name}")

            return {
                "url": url,
                "object_name": unique_name,
                "size": len(file_data),
                "content_type": content_type
            }

        except S3Error as e:
            print(f"MinIO S3 error: {e}")
            return {"error": f"Storage error: {str(e)}"}
        except Exception as e:
            print(f"Error uploading image: {e}")
            return {"error": f"Upload failed: {str(e)}"}

    def delete_image(self, object_name: str) -> bool:
        """
        Delete an image from MinIO

        Args:
            object_name: The object name/path in the bucket

        Returns:
            True if deleted successfully, False otherwise
        """
        self._ensure_initialized()
        if not self.client:
            return False

        try:
            self.client.remove_object(self.bucket, object_name)
            print(f"Deleted image: {object_name}")
            return True
        except Exception as e:
            print(f"Error deleting image: {e}")
            return False

    def get_presigned_url(self, object_name: str, expires_hours: int = 24) -> Optional[str]:
        """
        Get a presigned URL for temporary access to a private image

        Args:
            object_name: The object name/path in the bucket
            expires_hours: URL expiration time in hours

        Returns:
            Presigned URL or None if failed
        """
        self._ensure_initialized()
        if not self.client:
            return None

        try:
            url = self.client.presigned_get_object(
                self.bucket,
                object_name,
                expires=timedelta(hours=expires_hours)
            )
            return url
        except Exception as e:
            print(f"Error generating presigned URL: {e}")
            return None

    def extract_object_name_from_url(self, url: str) -> Optional[str]:
        """Extract object name from a MinIO URL"""
        if not url:
            return None

        try:
            # URL format: http://endpoint/bucket/object_name
            # or: https://public-url/bucket/object_name
            parts = url.split(f"/{self.bucket}/")
            if len(parts) > 1:
                return parts[1].split('?')[0]  # Remove query params if any
            return None
        except Exception:
            return None

    async def upload_file(self, file, folder: str = "files") -> Optional[dict]:
        """
        Upload any file to MinIO (for materials, documents, etc.)

        Args:
            file: FastAPI UploadFile object
            folder: Folder/prefix for organizing files

        Returns:
            Dictionary with file URL and object name, or None if failed
        """
        self._ensure_initialized()
        if not self.client:
            return None

        try:
            # Read file content
            file_data = await file.read()

            # Generate unique filename
            ext = file.filename.lower().split('.')[-1] if '.' in file.filename else 'bin'
            unique_name = f"{folder}/{uuid.uuid4().hex}.{ext}"

            # Get content type
            content_type = file.content_type or 'application/octet-stream'

            # Upload to MinIO
            self.client.put_object(
                self.bucket,
                unique_name,
                io.BytesIO(file_data),
                length=len(file_data),
                content_type=content_type
            )

            # Generate public URL
            if settings.MINIO_PUBLIC_URL:
                url = f"{settings.MINIO_PUBLIC_URL}/{self.bucket}/{unique_name}"
            else:
                protocol = "https" if settings.MINIO_SECURE else "http"
                url = f"{protocol}://{settings.MINIO_ENDPOINT}/{self.bucket}/{unique_name}"

            print(f"Uploaded file: {unique_name}")

            return {
                "url": url,
                "object_name": unique_name,
                "size": len(file_data),
                "content_type": content_type
            }

        except Exception as e:
            print(f"Error uploading file: {e}")
            return None

    async def delete_file(self, url: str) -> bool:
        """
        Delete a file from MinIO by its URL

        Args:
            url: The full URL of the file

        Returns:
            True if deleted successfully, False otherwise
        """
        object_name = self.extract_object_name_from_url(url)
        if object_name:
            return self.delete_image(object_name)
        return False


# Singleton instance
minio_service = MinIOService()
