import json
import unittest
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch
from fastapi import Response
from pydantic import ValidationError

from agent.history_manager import HistoryManager
from db.db_init import ensure_agent_default_skill, ensure_user_role
from models.user import (
    UserPasswordUpdateRequest,
    UserRegisterRequest,
    UserUpdateRequest,
)
from services.history_service import normalize_history_payload
from services.user_service import login_user, register_user, update_user_password


class HistoryManagerTest(unittest.TestCase):
    def test_trim_messages_uses_approximate_counter_and_restores_api_roles(self):
        messages = [
            {"role": "user", "content": "较早问题 " * 100},
            {"role": "assistant", "content": "较早回答 " * 100},
            {"role": "user", "content": "最新问题"},
        ]

        result = HistoryManager._trim_messages(messages, max_tokens=30)

        self.assertEqual(result, [{"role": "user", "content": "最新问题"}])


class HistoryPayloadTest(unittest.TestCase):
    def test_legacy_records_are_upgraded(self):
        payload = normalize_history_payload(
            [
                {"role": "user", "content": "问题", "files": "a.png"},
                {
                    "role": "assistant",
                    "content": "回答",
                    "steps": [{"name": "model", "status": "completed"}],
                    "artifacts": [{"url": "https://oss/file.docx"}],
                },
            ]
        )
        self.assertEqual(payload["schemaVersion"], 2)
        self.assertEqual(payload["messages"][0]["files"], "a.png")
        self.assertEqual(len(payload["messages"][1]["nodes"]), 2)
        self.assertEqual(payload["messages"][1]["nodes"][1]["kind"], "file")
        self.assertEqual(
            payload["messages"][1]["nodes"][1]["fileUrl"],
            "https://oss/file.docx",
        )
        self.assertEqual(len(payload["messages"][1]["artifacts"]), 1)

    def test_v2_records_keep_complete_chat_state(self):
        original = {
            "schemaVersion": 2,
            "messages": [
                {
                    "key": "a",
                    "role": "assistant",
                    "content": "回答",
                    "nodes": [{"id": "n", "status": "success"}],
                    "knowledge": [{"fileId": "k"}],
                    "artifacts": [{"id": "f"}],
                    "skills": ["web-search"],
                    "status": "complete",
                }
            ],
        }
        payload = normalize_history_payload(original)
        message = payload["messages"][0]
        self.assertEqual(message["nodes"][0]["id"], "n")
        self.assertEqual(message["knowledge"][0]["fileId"], "k")
        self.assertEqual(message["artifacts"][0]["id"], "f")
        self.assertEqual(message["skills"], ["web-search"])

    def test_legacy_artifact_metadata_is_kept_in_file_node(self):
        payload = normalize_history_payload(
            [
                {
                    "role": "assistant",
                    "content": "报告已生成",
                    "artifacts": [
                        {
                            "url": "https://oss.example/report.pdf",
                            "name": "报告.pdf",
                            "format": "pdf",
                            "mimeType": "application/pdf",
                            "size": 2048,
                        }
                    ],
                }
            ]
        )
        file_node = payload["messages"][0]["nodes"][0]
        self.assertEqual(file_node["kind"], "file")
        self.assertEqual(file_node["fileUrl"], "https://oss.example/report.pdf")
        self.assertEqual(
            file_node["details"]["files"][0]["fileName"], "报告.pdf"
        )


class ChatSnapshotTest(unittest.IsolatedAsyncioTestCase):
    async def test_replacement_event_reconciles_streamed_content(self):
        from routers.agent import ChatRequest, chat_generator

        async def fake_chat_stream(**_):
            yield json.dumps({"event": "message", "content": "草稿"})
            yield json.dumps({
                "event": "message",
                "content": "最终回答",
                "replaceContent": True,
                "done": True,
            })

        request = ChatRequest(agentCode="test", text="测试")
        with patch(
            "routers.agent.AgentService.chat_stream",
            side_effect=fake_chat_stream,
        ), patch("routers.agent.AgentService.get_agent_config", return_value={"agent_code": "test"}):
            chunks = [item async for item in chat_generator(request, username="")]

        done = json.loads(chunks[-1].removeprefix("data: ").strip())
        self.assertEqual(done["message"]["content"], "最终回答")

    async def test_done_snapshot_content_does_not_include_file_metadata(self):
        from routers.agent import ChatRequest, chat_generator

        async def fake_chat_stream(**_):
            yield json.dumps(
                {"event": "message", "content": "纯正文", "thinkMessage": ""}
            )
            yield json.dumps(
                {
                    "event": "artifact",
                    "artifacts": [
                        {
                            "url": "https://oss.example/report.pdf",
                            "name": "报告.pdf",
                        }
                    ],
                    "fileUrl": "https://oss.example/report.pdf",
                }
            )
            yield json.dumps(
                {
                    "event": "node",
                    "node": {
                        "id": "skill-artifact-generator",
                        "kind": "file",
                        "status": "success",
                        "fileUrl": "https://oss.example/report.pdf",
                        "details": {"files": []},
                    },
                }
            )
            yield json.dumps({"event": "done", "done": True})

        request = ChatRequest(agentCode="test", text="生成 PDF")
        with patch(
            "routers.agent.AgentService.chat_stream",
            side_effect=fake_chat_stream,
        ), patch("routers.agent.AgentService.get_agent_config", return_value={"agent_code": "test"}):
            chunks = [
                item
                async for item in chat_generator(request, username="")
            ]

        done = json.loads(chunks[-1].removeprefix("data: ").strip())
        self.assertEqual(done["message"]["content"], "纯正文")
        self.assertNotIn("https://oss.example", done["message"]["content"])
        self.assertEqual(
            done["message"]["nodes"][0]["fileUrl"],
            "https://oss.example/report.pdf",
        )


class UserRequestValidationTest(unittest.TestCase):
    def test_username_cannot_be_updated(self):
        with self.assertRaises(ValidationError):
            UserUpdateRequest(username="999")

    def test_role_cannot_be_updated_from_profile(self):
        with self.assertRaises(ValidationError):
            UserUpdateRequest(role="admin")

    def test_profile_ranges_are_validated(self):
        with self.assertRaises(ValidationError):
            UserUpdateRequest(age=151)
        with self.assertRaises(ValidationError):
            UserUpdateRequest(gender=2)

    def test_password_requires_six_characters(self):
        with self.assertRaises(ValidationError):
            UserPasswordUpdateRequest(currentPassword="old", newPassword="123")

    def test_password_update_rejects_wrong_current_password(self):
        user = SimpleNamespace(userpassword="hashed")

        class FakeQuery:
            def filter_by(self, **_):
                return self

            def first(self):
                return user

        class FakeSession:
            def query(self, *_):
                return FakeQuery()

            def close(self):
                pass

            def rollback(self):
                pass

        with (
            patch("services.user_service.get_session", return_value=FakeSession()),
            patch("services.user_service.verify_password", return_value=False),
        ):
            result = update_user_password(1, "wrong", "new-password")
        self.assertEqual(result["code"], 1)
        self.assertEqual(result["message"], "当前密码错误")


class UserRoleTest(unittest.TestCase):
    def test_registered_user_defaults_to_user_role(self):
        class FakeQuery:
            def filter_by(self, **_):
                return self

            def first(self):
                return None

        class FakeSession:
            added = None

            def query(self, *_):
                return FakeQuery()

            def add(self, user):
                self.added = user

            def commit(self):
                pass

            def refresh(self, user):
                user.id = 1
                user.created_at = "2026-07-31 00:00:00"

            def close(self):
                pass

        session = FakeSession()
        request = UserRegisterRequest(username="100001", password="123456")
        with (
            patch("services.user_service.get_session", return_value=session),
            patch("services.user_service.hash_password", return_value="hashed"),
        ):
            result = register_user(request)

        self.assertEqual(session.added.role, "user")
        self.assertEqual(result["code"], 0)
        self.assertEqual(result["data"]["role"], "user")

    def test_login_token_expires_after_24_hours(self):
        user = SimpleNamespace(
            id=1,
            username="100001",
            userpassword="hashed",
            role="user",
            avatar=None,
            nickname=None,
            gender=None,
            age=None,
            memory=False,
            created_at="2026-08-20 00:00:00",
        )

        class FakeQuery:
            def filter_by(self, **_):
                return self

            def first(self):
                return user

        class FakeSession:
            def query(self, *_):
                return FakeQuery()

            def close(self):
                pass

        with (
            patch("services.user_service.get_session", return_value=FakeSession()),
            patch("services.user_service.verify_password", return_value=True),
            patch(
                "services.user_service.create_access_token",
                return_value="token",
            ) as create_token,
        ):
            result = login_user("100001", "password")

        self.assertEqual(result["code"], 0)
        self.assertEqual(
            create_token.call_args.kwargs["expires_delta"],
            timedelta(hours=24),
        )

    def test_existing_users_are_backfilled_during_migration(self):
        class ScalarResult:
            def scalar(self):
                return 0

        class FakeSession:
            def __init__(self):
                self.statements = []
                self.committed = False

            def execute(self, statement):
                self.statements.append(str(statement))
                return ScalarResult()

            def commit(self):
                self.committed = True

            def rollback(self):
                pass

            def close(self):
                pass

        session = FakeSession()
        with patch("db.db_init.get_session", return_value=session):
            ensure_user_role()

        sql = "\n".join(session.statements)
        self.assertIn("ADD COLUMN role", sql)
        self.assertIn("UPDATE users SET role = 'user'", sql)
        self.assertTrue(session.committed)


class AuthCookieTest(unittest.IsolatedAsyncioTestCase):
    async def test_login_cookie_expires_after_24_hours(self):
        from routers.auth import login as login_endpoint
        from models.user import UserLoginRequest

        response = Response()
        request = UserLoginRequest(username="100001", password="password")
        login_result = {
            "code": 0,
            "message": "登录成功",
            "data": {"access_token": "token"},
        }

        with patch("routers.auth.login_user", return_value=login_result):
            await login_endpoint(request, response)

        self.assertIn("Max-Age=86400", response.headers["set-cookie"])


class AgentSkillMigrationTest(unittest.TestCase):
    def test_default_skill_column_is_added_idempotently(self):
        class ScalarResult:
            def scalar(self):
                return 0

        class FakeSession:
            def __init__(self):
                self.statements = []
                self.committed = False

            def execute(self, statement):
                self.statements.append(str(statement))
                return ScalarResult()

            def commit(self):
                self.committed = True

            def rollback(self):
                pass

            def close(self):
                pass

        session = FakeSession()
        with patch("db.db_init.get_session", return_value=session):
            ensure_agent_default_skill()

        self.assertTrue(
            any("ADD COLUMN default_skill" in sql for sql in session.statements)
        )
        self.assertTrue(session.committed)


if __name__ == "__main__":
    unittest.main()
