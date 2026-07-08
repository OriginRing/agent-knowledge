from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from db.sqlalchemy_connection import get_session
from models.db_models import User
from models.user import UserRegisterRequest, UserResponse

SECRET_KEY = "your-secret-key-keep-it-safe-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        expire = payload.get("exp")
        if expire is None or datetime.utcnow() > datetime.fromtimestamp(expire):
            return None
        return payload
    except JWTError:
        return None

def get_user_by_id(user_id: int):
    session = None
    try:
        session = get_session('agent-user')
        user = session.query(User).filter_by(id=user_id).first()
        
        if not user:
            return None
        
        return {
            'id': user.id,
            'username': user.username,
            'avatar': user.avatar,
            'nickname': user.nickname,
            'gender': user.gender,
            'age': user.age,
            'created_at': str(user.created_at)
        }
    except Exception as e:
        return None
    finally:
        if session:
            session.close()

def register_user(request: UserRegisterRequest):
    session = None
    try:
        session = get_session('agent-user')
        
        existing_user = session.query(User).filter_by(username=request.username).first()
        if existing_user:
            return {'code': 1, 'message': '用户名已存在'}
        
        hashed_password = hash_password(request.password)
        
        new_user = User(
            username=request.username,
            userpassword=hashed_password,
            avatar=request.avatar,
            nickname=request.nickname,
            gender=request.gender,
            age=request.age
        )
        
        session.add(new_user)
        session.commit()
        session.refresh(new_user)
        
        user = UserResponse(
            id=new_user.id,
            username=new_user.username,
            avatar=new_user.avatar,
            nickname=new_user.nickname,
            gender=new_user.gender,
            age=new_user.age,
            created_at=str(new_user.created_at)
        )
        
        return {'code': 0, 'message': '注册成功', 'data': user.model_dump()}
    except Exception as e:
        return {'code': -1, 'message': f'注册失败: {str(e)}'}
    finally:
        if session:
            session.close()

def login_user(username: str, userpassword: str):
    session = None
    try:
        session = get_session('agent-user')
        
        user = session.query(User).filter_by(username=username).first()
        
        if not user or not verify_password(userpassword, user.userpassword):
            return {'code': 1, 'message': '用户名或密码错误'}
        
        user_response = UserResponse(
            id=user.id,
            username=user.username,
            avatar=user.avatar,
            nickname=user.nickname,
            gender=user.gender,
            age=user.age,
            created_at=str(user.created_at)
        )
        
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username, "id": user.id},
            expires_delta=access_token_expires
        )
        
        return {
            'code': 0, 
            'message': '登录成功', 
            'data': {
                'user': user_response.model_dump(),
                'access_token': access_token,
                'token_type': 'bearer'
            }
        }
    except Exception as e:
        return {'code': -1, 'message': f'登录失败: {str(e)}'}
    finally:
        if session:
            session.close()