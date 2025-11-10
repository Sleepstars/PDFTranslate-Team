"""
MinerU API client for PDF parsing to Markdown.

This module provides integration with the MinerU API service for extracting
content from PDF files and converting them to Markdown format.
"""

import asyncio
import inspect
import logging
import zipfile
import io
import re
from typing import Optional, Callable, Dict, Any, Awaitable, Union
import httpx
from datetime import datetime
from .mineru_markdown_converter import convert_middle_json_to_markdown

logger = logging.getLogger(__name__)

# Type alias for progress callback (sync or async)
ProgressCallback = Callable[[dict], Union[None, Awaitable[None]]]


async def _emit_progress(callback: Optional[ProgressCallback], payload: dict) -> None:
    """Safely invoke progress callbacks that may be sync or async."""
    if not callback:
        return
    try:
        result = callback(payload)
        if inspect.isawaitable(result):
            await result
    except Exception:
        logger.exception("MinerU progress callback failed")


class MinerUAPIError(Exception):
    """Exception raised for MinerU API errors."""
    pass


async def _download_and_extract_markdown(
    zip_url: str,
    s3_client=None,
    task_id: str = ""
) -> tuple[Optional[str], Optional[bytes]]:
    """Download ZIP file, extract markdown and upload images to S3.

    Returns:
        tuple: (markdown_with_s3_urls, original_zip_bytes)
    """
    def _normalize_image_key(raw_path: str) -> str:
        cleaned = (raw_path or "").strip()
        if not cleaned:
            return ""
        cleaned = cleaned.split('#', 1)[0]
        cleaned = cleaned.split('?', 1)[0]
        cleaned = cleaned.replace('\\', '/').strip()
        while cleaned.startswith('../'):
            cleaned = cleaned[3:]
        while cleaned.startswith('./'):
            cleaned = cleaned[2:]
        cleaned = cleaned.lstrip('/')
        return cleaned.lower()

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(zip_url)
            response.raise_for_status()

            zip_bytes = response.content
            markdown_content = None
            image_mapping: Dict[str, str] = {}

            def _register_image_path(path: str, url: str) -> None:
                key = _normalize_image_key(path)
                if not key:
                    return
                image_mapping[key] = url
                basename = key.split('/')[-1]
                if basename and basename not in image_mapping:
                    image_mapping[basename] = url

            with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
                # Extract images first if S3 client provided
                if s3_client:
                    for filename in zf.namelist():
                        normalized_filename = filename.replace('\\', '/')
                        lower_filename = normalized_filename.lower()
                        if 'images/' not in lower_filename or normalized_filename.endswith('/'):
                            continue
                        image_data = zf.read(filename)
                        image_name = normalized_filename.split('/')[-1]
                        s3_key = f"mineru/{task_id}/images/{image_name}"

                        # Detect content type
                        content_type = "image/jpeg"
                        lower_name = image_name.lower()
                        if lower_name.endswith('.png'):
                            content_type = "image/png"
                        elif lower_name.endswith('.jpg') or lower_name.endswith('.jpeg'):
                            content_type = "image/jpeg"
                        elif lower_name.endswith('.gif'):
                            content_type = "image/gif"

                        try:
                            s3_client.upload_file(image_data, s3_key, content_type)
                        except Exception:
                            logger.exception("Failed to mirror MinerU image %s to S3", filename)
                            raise

                        s3_url = s3_client.get_presigned_url(s3_key, expiration=86400)

                        # Map multiple path variants to S3 URL
                        images_index = lower_filename.index('images/')
                        after_images = normalized_filename[images_index + len('images/') :]
                        _register_image_path(normalized_filename, s3_url)
                        _register_image_path(after_images, s3_url)
                        _register_image_path(f"images/{after_images}", s3_url)
                        _register_image_path(image_name, s3_url)

                # Find and read markdown file
                for filename in zf.namelist():
                    if filename.endswith('.md'):
                        markdown_content = zf.read(filename).decode('utf-8')
                        break

            # Replace image paths with S3 URLs
            if markdown_content and image_mapping:
                pattern = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')

                def _replace(match: re.Match) -> str:
                    alt_text, path = match.groups()
                    normalized = _normalize_image_key(path)
                    candidates = [normalized]
                    if normalized:
                        basename = normalized.split('/')[-1]
                        if basename:
                            candidates.append(basename)
                    for candidate in candidates:
                        if candidate and candidate in image_mapping:
                            return f"![{alt_text}]({image_mapping[candidate]})"
                    return match.group(0)

                markdown_content = pattern.sub(_replace, markdown_content)

            return markdown_content, zip_bytes
    except Exception as e:
        logger.exception("Failed to download/extract ZIP")
        return None, None


class MinerUClient:
    """Client for interacting with MinerU API."""

    def __init__(self, api_token: str, base_url: str = "https://mineru.net/api/v4"):
        """
        Initialize MinerU client.

        Args:
            api_token: MinerU API token
            base_url: Base URL for MinerU API (default: https://mineru.net/api/v4)
        """
        self.api_token = api_token
        self.base_url = base_url
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_token}",
            "Accept": "*/*"
        }

    async def submit_parse_task(
        self,
        pdf_url: str,
        model_version: str = "vlm",
        return_images: bool = True
    ) -> str:
        """
        Submit a PDF parsing task to MinerU API.

        Args:
            pdf_url: Public URL of the PDF file to parse
            model_version: Model version to use (default: "vlm")
            return_images: Return images as base64 (default: True)

        Returns:
            task_id: MinerU task ID for tracking

        Raises:
            MinerUAPIError: If API request fails
        """
        url = f"{self.base_url}/extract/task"
        data = {
            "url": pdf_url,
            "model_version": model_version,
            "return_images": return_images
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=self.headers, json=data)
                response.raise_for_status()

                result = response.json()
                code = result.get("code", 0)
                if code not in (0, 200):
                    raise MinerUAPIError(f"MinerU API error: {result}")
                if "data" not in result:
                    raise MinerUAPIError(f"Invalid API response: {result}")
                data = result["data"]
                if isinstance(data, dict):
                    task_id = data.get("task_id") or data.get("taskId") or data.get("id")
                else:
                    task_id = data
                if not task_id:
                    raise MinerUAPIError(f"Task ID missing in response: {result}")
                logger.info(f"MinerU task submitted successfully: {task_id}")
                return task_id

        except httpx.HTTPStatusError as e:
            logger.error(f"MinerU API HTTP error: {e.response.status_code} - {e.response.text}")
            raise MinerUAPIError(f"HTTP {e.response.status_code}: {e.response.text}")
        except httpx.RequestError as e:
            logger.error(f"MinerU API request error: {str(e)}")
            raise MinerUAPIError(f"Request failed: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error submitting MinerU task: {str(e)}")
            raise MinerUAPIError(f"Unexpected error: {str(e)}")

    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        Get the status of a MinerU parsing task.

        Args:
            task_id: MinerU task ID

        Returns:
            Task status information including:
            - status: Task status (pending/processing/completed/failed)
            - progress: Progress percentage (0-100)
            - result: Markdown content (if completed)
            - error: Error message (if failed)

        Raises:
            MinerUAPIError: If API request fails
        """
        url = f"{self.base_url}/extract/task/{task_id}"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()

                result = response.json()
                code = result.get("code", 0)
                if code not in (0, 200):
                    raise MinerUAPIError(f"MinerU API error: {result}")
                if "data" not in result:
                    raise MinerUAPIError(f"Invalid API response: {result}")

                return result["data"]

        except httpx.HTTPStatusError as e:
            logger.error(f"MinerU API HTTP error: {e.response.status_code} - {e.response.text}")
            raise MinerUAPIError(f"HTTP {e.response.status_code}: {e.response.text}")
        except httpx.RequestError as e:
            logger.error(f"MinerU API request error: {str(e)}")
            raise MinerUAPIError(f"Request failed: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error getting MinerU task status: {str(e)}")
            raise MinerUAPIError(f"Unexpected error: {str(e)}")

    async def wait_for_completion(
        self,
        task_id: str,
        progress_callback: Optional[ProgressCallback] = None,
        poll_interval: int = 5,
        max_wait_time: int = 600
    ) -> Dict[str, Any]:
        """
        Wait for a MinerU task to complete, polling for status updates.

        Args:
            task_id: MinerU task ID
            progress_callback: Optional callback for progress updates
            poll_interval: Seconds between status checks (default: 5)
            max_wait_time: Maximum wait time in seconds (default: 600 = 10 minutes)

        Returns:
            Final task result with markdown content

        Raises:
            MinerUAPIError: If task fails or times out
        """
        start_time = datetime.now()
        last_progress = 0

        while True:
            # Check timeout
            elapsed = (datetime.now() - start_time).total_seconds()
            if elapsed > max_wait_time:
                raise MinerUAPIError(f"Task timeout after {max_wait_time} seconds")

            # Get task status
            status_data = await self.get_task_status(task_id)
            status_raw = (
                status_data.get("status")
                or status_data.get("task_status")
                or status_data.get("state")
                or "unknown"
            )
            status = str(status_raw).lower()
            progress = status_data.get("progress")
            if progress is None:
                progress = status_data.get("overall_progress")
            if progress is None:
                progress = status_data.get("percentage")
            progress = int(float(progress)) if progress is not None else 0

            # Update progress if changed
            if progress != last_progress:
                await _emit_progress(
                    progress_callback,
                    {
                        "overall_progress": progress,
                        "stage": f"MinerU解析中 ({status})",
                        "status": status,
                    },
                )
                last_progress = progress

            # Check completion
            if status in {"completed", "complete", "success", "finished", "done"}:
                logger.info(f"MinerU task {task_id} completed successfully")
                return status_data
            elif status in {"failed", "error"}:
                error_msg = (
                    status_data.get("error")
                    or status_data.get("err_msg")
                    or status_data.get("error_message")
                    or status_data.get("message")
                    or "Unknown error"
                )
                logger.error(f"MinerU task {task_id} failed. Status data: {status_data}")
                raise MinerUAPIError(f"Task failed: {error_msg}")

            # Wait before next poll
            await asyncio.sleep(poll_interval)


async def parse_pdf_to_markdown(
    pdf_url: str,
    api_token: str,
    model_version: str = "vlm",
    progress_callback: Optional[ProgressCallback] = None,
    poll_interval: int = 5,
    max_wait_time: int = 600,
    s3_client=None
) -> tuple[bool, Optional[str], Optional[str], Optional[bytes]]:
    """
    Parse a PDF file to Markdown using MinerU API.

    This is the main entry point for PDF parsing. It submits the task,
    waits for completion, and returns the markdown content and original ZIP.

    Args:
        pdf_url: Public URL of the PDF file
        api_token: MinerU API token
        model_version: Model version to use (default: "vlm")
        progress_callback: Optional callback for progress updates
        poll_interval: Seconds between status checks (default: 5)
        max_wait_time: Maximum wait time in seconds (default: 600)
        s3_client: Optional S3 client for uploading images

    Returns:
        Tuple of (success, error_message, markdown_content, zip_bytes)
        - success: True if parsing succeeded
        - error_message: Error message if failed, None if succeeded
        - markdown_content: Markdown with S3 URLs if succeeded, None if failed
        - zip_bytes: Original ZIP file bytes with images and markdown
    """
    try:
        # Initialize client
        client = MinerUClient(api_token)

        # Submit task
        await _emit_progress(
            progress_callback,
            {
                "overall_progress": 5,
                "stage": "提交MinerU解析任务",
                "status": "submitting",
            },
        )

        task_id = await client.submit_parse_task(pdf_url, model_version)

        await _emit_progress(
            progress_callback,
            {
                "overall_progress": 10,
                "stage": "等待MinerU处理",
                "status": "waiting",
                "mineru_task_id": task_id,
            },
        )

        # Wait for completion
        result = await client.wait_for_completion(
            task_id,
            progress_callback=progress_callback,
            poll_interval=poll_interval,
            max_wait_time=max_wait_time
        )

        # Check for ZIP URL first
        zip_url = result.get("full_zip_url")
        if zip_url:
            logger.info(f"Downloading markdown from ZIP: {zip_url}")
            markdown_content, zip_bytes = await _download_and_extract_markdown(
                zip_url,
                s3_client=s3_client,
                task_id=task_id
            )
            if markdown_content:
                await _emit_progress(
                    progress_callback,
                    {
                        "overall_progress": 100,
                        "stage": "解析完成",
                        "status": "completed",
                    },
                )
                return True, None, markdown_content, zip_bytes

        # Fallback: Extract markdown content from response
        markdown_content = None
        candidate_sections = [
            result.get("result"),
            result.get("data"),
            result,
        ]
        for section in candidate_sections:
            if isinstance(section, dict):
                markdown_content = (
                    section.get("markdown")
                    or section.get("content")
                    or section.get("text")
                    or section.get("markdown_content")
                )
                if not markdown_content and "pdf_info" in section:
                    try:
                        markdown_content = convert_middle_json_to_markdown(section)
                    except Exception as e:
                        logger.error(f"Failed to convert middle.json: {e}")
            elif isinstance(section, str):
                markdown_content = section
            if markdown_content:
                break

        if not markdown_content:
            logger.error(f"No markdown found. Response: {result}")
            return False, "No markdown content in MinerU response", None, None

        if progress_callback:
            await _emit_progress(
                progress_callback,
                {
                    "overall_progress": 100,
                    "stage": "解析完成",
                    "status": "completed",
                },
            )

        return True, None, markdown_content, None

    except MinerUAPIError as e:
        logger.error(f"MinerU parsing failed: {str(e)}")
        return False, str(e), None, None
    except Exception as e:
        logger.error(f"Unexpected error during PDF parsing: {str(e)}")
        return False, f"Unexpected error: {str(e)}", None, None
