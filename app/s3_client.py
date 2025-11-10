import boto3
from datetime import datetime, timedelta, timezone
from typing import Optional
from botocore.exceptions import ClientError
from .settings_manager import MissingS3Configuration


class S3Client:
    REQUIRED_FIELDS = ("access_key", "secret_key", "bucket", "region")

    def __init__(self, config: Optional[dict] = None):
        if config is None:
            raise ValueError("S3 configuration is required")

        missing = [field for field in self.REQUIRED_FIELDS if not config.get(field)]
        if missing:
            raise ValueError(f"S3 configuration missing required fields: {', '.join(missing)}")

        self.s3 = boto3.client(
            's3',
            endpoint_url=config.get("endpoint") or None,
            aws_access_key_id=config["access_key"],
            aws_secret_access_key=config["secret_key"],
            region_name=config["region"]
        )
        self.bucket = config["bucket"]
        self.ttl_days = config["ttl_days"]

    def upload_file(self, file_data: bytes, key: str, content_type: str = "application/pdf") -> str:
        self.s3.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=file_data,
            ContentType=content_type
        )
        return key

    def get_presigned_url(self, key: str, expiration: int = 3600) -> str:
        try:
            url = self.s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket, 'Key': key},
                ExpiresIn=expiration
            )
            return url
        except ClientError:
            return ""

    def delete_file(self, key: str):
        try:
            self.s3.delete_object(Bucket=self.bucket, Key=key)
        except ClientError:
            pass

    def delete_expired_files(self):
        try:
            response = self.s3.list_objects_v2(Bucket=self.bucket)
            if 'Contents' not in response:
                return

            if self.ttl_days <= 0:
                return

            now = datetime.now(timezone.utc)
            ttl_delta = timedelta(days=self.ttl_days)
            for obj in response['Contents']:
                last_modified = obj.get('LastModified')
                if not isinstance(last_modified, datetime):
                    continue

                if last_modified.tzinfo is None:
                    last_modified = last_modified.replace(tzinfo=timezone.utc)

                if last_modified + ttl_delta <= now:
                    self.delete_file(obj['Key'])
        except ClientError:
            pass

    def delete_prefix(self, prefix: str):
        """Delete all objects under a given prefix.

        Best-effort: ignores missing keys and continues on partial failures.
        """
        try:
            paginator = self.s3.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
                contents = page.get('Contents') or []
                if not contents:
                    continue
                # Batch delete up to 1000 objects per request
                objects = [{'Key': obj['Key']} for obj in contents if 'Key' in obj]
                # Some S3-compatible providers may not support delete_objects; fall back if needed
                try:
                    self.s3.delete_objects(Bucket=self.bucket, Delete={'Objects': objects})
                except ClientError:
                    for obj in objects:
                        try:
                            self.delete_file(obj['Key'])
                        except ClientError:
                            pass
        except ClientError:
            # Ignore prefix delete errors
            pass

def get_s3(config: Optional[dict] = None):
    """Return an initialized S3Client or raise MissingS3Configuration.

    This is tolerant during normal read paths: callers that want to gracefully
    handle missing storage can catch MissingS3Configuration and proceed with
    s3=None (e.g., task listing without presigned URLs). For write paths, call
    get_s3_config(..., strict=True) first so misconfiguration is surfaced early.
    """
    if not config:
        raise MissingS3Configuration(
            "S3 storage is not configured. Please open Admin > Settings > S3 to complete the configuration."
        )

    # If any required field is missing/empty, treat as not configured
    required = S3Client.REQUIRED_FIELDS
    missing = [field for field in required if not config.get(field)]
    if missing:
        raise MissingS3Configuration(
            f"S3 storage is not fully configured (missing: {', '.join(missing)}). "
            "Please open Admin > Settings > S3 to complete the configuration."
        )

    return S3Client(config)
