import unittest
from types import SimpleNamespace
from unittest.mock import patch

from pydantic import ValidationError

from models.background import BackgroundImageCreateRequest
from routers.auth import save_background_image
from services.background_service import create_background_image, get_background_images


class BackgroundImageServiceTest(unittest.TestCase):
    def test_serializes_visible_background_images(self):
        images = [
            SimpleNamespace(
                id=1,
                name='星空',
                url='/bg-images/star.jpg',
                userId=None,
                push=True,
                promotionText='试试新的星空背景',
            ),
            SimpleNamespace(
                id=2,
                name='我的背景',
                url='https://example.com/mine.jpg',
                userId='000001',
                push=False,
                promotionText=None,
            ),
        ]

        class FakeQuery:
            def filter(self, *_):
                return self

            def order_by(self, *_):
                return self

            def all(self):
                return images

        class FakeSession:
            def query(self, *_):
                return FakeQuery()

            def close(self):
                pass

        with patch(
            'services.background_service.get_session',
            return_value=FakeSession(),
        ):
            result = get_background_images('000001')

        self.assertEqual(result['code'], 0)
        self.assertEqual(result['data'][0]['id'], 1)
        self.assertTrue(result['data'][0]['push'])
        self.assertEqual(result['data'][0]['promotionText'], '试试新的星空背景')
        self.assertEqual(result['data'][1]['userId'], '000001')

    def test_creates_private_background_for_current_username(self):
        saved = []

        class FakeSession:
            def add(self, image):
                image.id = 3
                saved.append(image)

            def commit(self):
                pass

            def refresh(self, _):
                pass

            def rollback(self):
                pass

            def close(self):
                pass

        with patch(
            'services.background_service.get_session',
            return_value=FakeSession(),
        ):
            result = create_background_image(
                '000001',
                '我的星空.jpg',
                'https://oss.example/my-star.jpg',
            )

        self.assertEqual(result['code'], 0)
        self.assertEqual(result['data']['id'], 3)
        self.assertEqual(saved[0].userId, '000001')
        self.assertFalse(saved[0].push)


class BackgroundImageRequestTest(unittest.IsolatedAsyncioTestCase):
    async def test_owner_comes_from_login_token(self):
        request = BackgroundImageCreateRequest(
            name='我的星空.jpg',
            url='https://oss.example/my-star.jpg',
        )
        expected = {'code': 0, 'message': 'success', 'data': {'id': 3}}

        with patch(
            'routers.auth.decode_token',
            return_value={'sub': '000001'},
        ), patch(
            'routers.auth.create_background_image',
            return_value=expected,
        ) as create_mock:
            result = await save_background_image(request, access_token='token')

        self.assertEqual(result, expected)
        create_mock.assert_called_once_with(
            '000001',
            '我的星空.jpg',
            'https://oss.example/my-star.jpg',
        )

    def test_client_cannot_assign_background_owner(self):
        with self.assertRaises(ValidationError):
            BackgroundImageCreateRequest(
                name='伪造归属.jpg',
                url='https://oss.example/forged.jpg',
                userId='another-user',
            )


if __name__ == '__main__':
    unittest.main()
