from sqlalchemy import or_

from db.sqlalchemy_connection import get_session
from models.db_models import BackgroundImage


def _serialize_background_image(image: BackgroundImage):
    return {
        'id': image.id,
        'name': image.name,
        'url': image.url,
        'userId': image.userId,
        'push': bool(image.push),
    }


def get_background_images(user_name: str):
    session = None
    try:
        session = get_session('agent-user')
        images = (
            session.query(BackgroundImage)
            .filter(
                or_(
                    BackgroundImage.push.is_(True),
                    BackgroundImage.userId == user_name,
                )
            )
            .order_by(BackgroundImage.id.asc())
            .all()
        )
        return {
            'code': 0,
            'message': 'success',
            'data': [_serialize_background_image(image) for image in images],
        }
    except Exception as exc:
        return {'code': -1, 'message': f'背景图列表获取失败: {exc}', 'data': []}
    finally:
        if session:
            session.close()


def create_background_image(user_name: str, name: str, url: str):
    session = None
    try:
        session = get_session('agent-user')
        image = BackgroundImage(
            name=name,
            url=url,
            userId=user_name,
            push=False,
        )
        session.add(image)
        session.commit()
        session.refresh(image)
        return {
            'code': 0,
            'message': '背景图保存成功',
            'data': _serialize_background_image(image),
        }
    except Exception as exc:
        if session:
            session.rollback()
        return {'code': -1, 'message': f'背景图保存失败: {exc}', 'data': None}
    finally:
        if session:
            session.close()
