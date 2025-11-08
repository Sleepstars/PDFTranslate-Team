import boto3
from datetime import datetime, timedelta, timezone
from typing import Optional
from botocore.exceptions import ClientError


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

def get_s3(config: Optional[dict] = None):
    if not config:
        raise ValueError("Please provide an S3 configuration from the database")
    return S3Client(config)
