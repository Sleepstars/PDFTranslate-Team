import boto3
from datetime import datetime, timedelta
from typing import Optional
from botocore.exceptions import ClientError
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings

settings = get_settings()

class S3Client:
    def __init__(self, config: Optional[dict] = None):
        if config is None:
            config = {
                "endpoint": settings.s3_endpoint,
                "access_key": settings.s3_access_key,
                "secret_key": settings.s3_secret_key,
                "bucket": settings.s3_bucket,
                "region": settings.s3_region,
                "ttl_days": settings.s3_file_ttl_days
            }

        self.s3 = boto3.client(
            's3',
            endpoint_url=config["endpoint"] if config["endpoint"] else None,
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
            ContentType=content_type,
            Tagging=f"expires_at={int((datetime.utcnow() + timedelta(days=self.ttl_days)).timestamp())}"
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

            now = int(datetime.utcnow().timestamp())
            for obj in response['Contents']:
                try:
                    tags = self.s3.get_object_tagging(Bucket=self.bucket, Key=obj['Key'])
                    for tag in tags.get('TagSet', []):
                        if tag['Key'] == 'expires_at' and int(tag['Value']) < now:
                            self.delete_file(obj['Key'])
                except ClientError:
                    pass
        except ClientError:
            pass

s3_client = S3Client()

def get_s3(config: Optional[dict] = None):
    if config:
        return S3Client(config)
    return s3_client
