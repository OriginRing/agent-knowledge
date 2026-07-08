import os
import uuid
from dotenv import load_dotenv
import oss2

load_dotenv()

class FileService:
    _bucket = None

    @classmethod
    def get_bucket(cls):
        if cls._bucket is None:
            access_key_id = os.getenv('OSS_ACCESS_KEY_ID')
            access_key_secret = os.getenv('OSS_ACCESS_KEY_SECRET')
            endpoint = os.getenv('OSS_ENDPOINT')
            bucket_name = os.getenv('OSS_BUCKET_NAME')
            
            if not all([access_key_id, access_key_secret, endpoint, bucket_name]):
                raise ValueError('OSS 配置不完整，请检查 .env 文件')
            
            auth = oss2.Auth(access_key_id, access_key_secret)
            cls._bucket = oss2.Bucket(auth, endpoint, bucket_name)
        
        return cls._bucket

    @classmethod
    def upload_file(cls, file_bytes, filename):
        try:
            bucket = cls.get_bucket()
            
            ext = os.path.splitext(filename)[1]
            new_filename = f"{uuid.uuid4().hex}{ext}"
            object_key = f"uploads/{new_filename}"
            
            bucket.put_object(object_key, file_bytes)
            
            url = f"https://{os.getenv('OSS_BUCKET_NAME')}.{os.getenv('OSS_ENDPOINT')}/{object_key}"
            return {'code': 0, 'message': 'success', 'data': {'url': url, 'filename': filename}}
        
        except Exception as e:
            return {'code': -1, 'message': f'上传失败: {str(e)}'}

    @classmethod
    def upload_files(cls, files):
        results = []
        for file in files:
            result = cls.upload_file(file['content'], file['filename'])
            results.append(result)
        
        success_count = sum(1 for r in results if r['code'] == 0)
        if success_count == len(results):
            return {'code': 0, 'message': '全部上传成功', 'data': [r['data'] for r in results]}
        else:
            return {'code': -1, 'message': f'部分上传失败，成功 {success_count}/{len(results)}', 'data': results}