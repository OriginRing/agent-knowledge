import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import requests

from services.document_service import DocumentService
from services.file_process_service import FileProcessService
from services.memory_service import format_memory_context
from services.skill_service import SkillService


class SkillServiceTest(unittest.TestCase):
    def tearDown(self):
        SkillService._cache = None

    def test_builtin_image_skill_is_selected(self):
        skill = SkillService.select_skill(
            "请分析这张图并生成文档",
            ["https://example.com/demo.png?version=1"],
        )
        self.assertIsNotNone(skill)
        self.assertEqual(skill.name, "image-to-document")
        self.assertEqual(skill.artifact, "docx")

    def test_explicit_unknown_skill_raises(self):
        with self.assertRaisesRegex(ValueError, "技能不存在"):
            SkillService.select_skill("test", [], requested_skill="missing")

    def test_custom_skills_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            skill_dir = Path(directory) / "demo"
            skill_dir.mkdir()
            (skill_dir / "SKILL.md").write_text(
                "---\nname: demo\nintent_keywords: 测试\n---\n测试提示词",
                encoding="utf-8",
            )
            with patch.dict(os.environ, {"AGENT_SKILLS_DIR": directory}):
                skills = SkillService.load_skills(refresh=True)
            self.assertIn("demo", skills)
            self.assertEqual(skills["demo"].prompt, "测试提示词")

    def test_detects_multiple_artifact_formats_in_order(self):
        self.assertEqual(
            SkillService.detect_artifact_formats(
                "请生成 PDF、Word、Excel 和 PPT 四个文件"
            ),
            ["docx", "xlsx", "pptx", "pdf"],
        )
        self.assertEqual(
            SkillService.detect_artifact_formats("", "pdf,docx,pdf"),
            ["pdf", "docx"],
        )


class DocumentServiceTest(unittest.TestCase):
    def test_build_docx(self):
        content = DocumentService.build_docx(
            "# 图片分析报告\n\n- 识别内容\n\n1. 结论"
        )
        self.assertTrue(content.startswith(b"PK"))
        self.assertGreater(len(content), 1000)

    def test_create_and_upload_returns_artifact(self):
        with patch(
            "services.file_service.FileService.upload_file",
            return_value={
                "code": 0,
                "message": "success",
                "data": {
                    "url": "https://oss.example/report.docx",
                    "filename": "report.docx",
                },
            },
        ) as upload_mock:
            artifact = DocumentService.create_and_upload("# 报告\n内容")
        self.assertEqual(artifact["format"], "docx")
        self.assertEqual(artifact["url"], "https://oss.example/report.docx")
        self.assertEqual(upload_mock.call_args.kwargs["object_prefix"], "generated")

    def test_builds_all_supported_formats(self):
        markdown = "# 报告\n\n| 名称 | 数值 |\n| --- | --- |\n| A | 1 |\n\n## 结论\n- 正常"
        for artifact_format in ("docx", "xlsx", "pptx", "pdf"):
            with self.subTest(artifact_format=artifact_format):
                content = DocumentService.build_file(
                    markdown,
                    artifact_format,
                    "测试文件",
                )
                self.assertGreater(len(content), 500)
                if artifact_format != "pdf":
                    self.assertTrue(content.startswith(b"PK"))
                else:
                    self.assertTrue(content.startswith(b"%PDF"))

    @unittest.skipUnless(
        os.getenv("RUN_OSS_INTEGRATION") == "1",
        "设置 RUN_OSS_INTEGRATION=1 后执行真实 OSS 上传验证",
    )
    def test_uploads_all_formats_to_configured_oss(self):
        markdown = "# OSS 集成测试\n\n| 项目 | 状态 |\n| --- | --- |\n| 上传 | 正常 |"
        for artifact_format in ("docx", "xlsx", "pptx", "pdf"):
            with self.subTest(artifact_format=artifact_format):
                artifact = DocumentService.create_and_upload(
                    markdown,
                    title="OSS集成测试",
                    artifact_format=artifact_format,
                )
                self.assertTrue(artifact["url"].startswith("https://"))
                self.assertGreater(artifact["size"], 500)
                response = requests.head(artifact["url"], timeout=10)
                self.assertEqual(response.status_code, 200)


class MemoryContextTest(unittest.TestCase):
    def test_formats_nested_memos_response_without_duplicates(self):
        result = {
            "code": 0,
            "data": {
                "data": {
                    "memory_detail_list": [
                        {"memory_value": "用户喜欢简洁报告"},
                        {"memory_value": "用户喜欢简洁报告"},
                    ],
                    "preference_detail_list": [
                        {"content": "默认使用中文"},
                    ],
                }
            },
        }
        context = format_memory_context(result)
        self.assertEqual(context.count("用户喜欢简洁报告"), 1)
        self.assertIn("默认使用中文", context)

    def test_failed_memory_response_is_empty(self):
        self.assertEqual(format_memory_context({"code": -1}), "")


class FileProcessServiceTest(unittest.TestCase):
    def test_parsed_content_is_returned_for_node_output(self):
        with (
            patch.object(
                FileProcessService,
                "download_file_from_url",
                return_value=b"hello",
            ),
            patch.object(
                FileProcessService,
                "extract_text",
                return_value="OCR 或文件解析正文",
            ),
        ):
            result = FileProcessService.process_files(
                ["https://oss.example/path/demo.png?version=1"]
            )
        self.assertEqual(result[0]["filename"], "demo.png")
        self.assertEqual(result[0]["content"], "OCR 或文件解析正文")
        self.assertEqual(result[0]["charCount"], len("OCR 或文件解析正文"))
        self.assertTrue(result[0]["isImage"])


class ChatPipelineTest(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def _config():
        return {
            "agent_code": "000001",
            "agent_name": "测试智能体",
            "model_type": "ollama",
            "model_name": "test",
            "base_url": "",
            "support_file": True,
            "support_think": True,
            "support_connect": True,
            "support_knowledge": True,
        }

    async def test_multiple_generated_files_use_one_file_node(self):
        from agent.agent_service import AgentService

        config = self._config()

        async def fake_model_stream(
            _config, _text, _thinking, _connect, _base_messages, context
        ):
            yield AgentService._event(
                config,
                event="message",
                content="# 报告\n内容",
                think_message="正在组织报告",
                **context,
            )
            yield AgentService._step(
                config,
                "model_call",
                "completed",
                "模型调用完成",
                node_id="model-call-1",
                node_kind="model",
                **context,
            )

        def execute_skill(name, **kwargs):
            self.assertEqual(name, "artifact-generator")
            artifact_format = kwargs["artifact_format"]
            return {
                "id": f"file-{artifact_format}",
                "type": "file",
                "format": artifact_format,
                "mimeType": "application/octet-stream",
                "name": f"报告.{artifact_format}",
                "url": f"https://oss.example/report.{artifact_format}",
                "size": 1024,
            }

        with (
            patch.object(AgentService, "get_agent_config", return_value=config),
            patch.object(
                AgentService, "_chat_stream_ollama", side_effect=fake_model_stream
            ),
            patch(
                "services.skill_service.SkillService.execute",
                side_effect=execute_skill,
            ),
            patch("services.memory_service.is_memory_enabled", return_value=True),
            patch(
                "services.memory_service.search_memory",
                return_value={"code": 0, "data": {}},
            ),
            patch(
                "services.memory_service.add_memory",
                return_value={"code": 0, "message": "success"},
            ) as add_memory_mock,
        ):
            chunks = [
                json.loads(chunk)
                async for chunk in AgentService.chat_stream(
                    agent_code="000001",
                    text="生成 Word 和 PDF",
                    thinking=True,
                    username="10001",
                )
            ]

        skill_node = next(
            item["node"]
            for item in chunks
            if item.get("node", {}).get("name") == "skill"
        )
        self.assertIn(
            "artifact-generator", skill_node["details"]["skills"]
        )
        file_nodes = [
            item["node"]
            for item in chunks
            if item.get("node", {}).get("id") == "skill-artifact-generator"
        ]
        self.assertEqual(file_nodes[-1]["kind"], "file")
        self.assertEqual(file_nodes[-1]["status"], "success")
        self.assertEqual(
            file_nodes[-1]["fileUrl"],
            "https://oss.example/report.docx,https://oss.example/report.pdf",
        )
        self.assertEqual(len(file_nodes[-1]["details"]["files"]), 2)
        artifact_event = next(
            item for item in chunks if item.get("event") == "artifact"
        )
        self.assertEqual(artifact_event["fileUrl"], file_nodes[-1]["fileUrl"])
        self.assertEqual(chunks[-1]["fileUrl"], file_nodes[-1]["fileUrl"])
        reasoning_nodes = [
            item["node"]
            for item in chunks
            if item.get("node", {}).get("id") == "model-call-1"
            and item["node"].get("details", {}).get("reasoning")
        ]
        self.assertEqual(
            reasoning_nodes[-1]["details"]["reasoning"], "正在组织报告"
        )
        message_content = "".join(
            item.get("content", "")
            for item in chunks
            if item.get("event") == "message"
        )
        self.assertEqual(message_content, "# 报告\n内容")
        self.assertNotIn("https://oss.example", message_content)
        add_memory_mock.assert_not_called()

    async def test_partial_file_failure_keeps_successful_url(self):
        from agent.agent_service import AgentService

        config = self._config()

        async def fake_model_stream(
            _config, _text, _thinking, _connect, _base_messages, context
        ):
            yield AgentService._event(
                config, event="message", content="报告正文", **context
            )

        def execute_skill(_name, **kwargs):
            if kwargs["artifact_format"] == "pdf":
                raise RuntimeError("PDF 上传失败")
            return {
                "id": "file-docx",
                "type": "file",
                "format": "docx",
                "mimeType": "application/octet-stream",
                "name": "报告.docx",
                "url": "https://oss.example/report.docx",
                "size": 1024,
            }

        with (
            patch.object(AgentService, "get_agent_config", return_value=config),
            patch.object(
                AgentService, "_chat_stream_ollama", side_effect=fake_model_stream
            ),
            patch(
                "services.skill_service.SkillService.execute",
                side_effect=execute_skill,
            ),
            patch("services.memory_service.is_memory_enabled", return_value=False),
        ):
            chunks = [
                json.loads(chunk)
                async for chunk in AgentService.chat_stream(
                    agent_code="000001",
                    text="生成 Word 和 PDF",
                )
            ]

        file_node = [
            item["node"]
            for item in chunks
            if item.get("node", {}).get("id") == "skill-artifact-generator"
        ][-1]
        self.assertEqual(file_node["status"], "error")
        self.assertEqual(file_node["fileUrl"], "https://oss.example/report.docx")
        self.assertEqual(len(file_node["details"]["errors"]), 1)

    async def test_all_file_failures_return_empty_url(self):
        from agent.agent_service import AgentService

        config = self._config()

        async def fake_model_stream(
            _config, _text, _thinking, _connect, _base_messages, context
        ):
            yield AgentService._event(
                config, event="message", content="报告正文", **context
            )

        with (
            patch.object(AgentService, "get_agent_config", return_value=config),
            patch.object(
                AgentService, "_chat_stream_ollama", side_effect=fake_model_stream
            ),
            patch(
                "services.skill_service.SkillService.execute",
                side_effect=RuntimeError("OSS 不可用"),
            ),
            patch("services.memory_service.is_memory_enabled", return_value=False),
        ):
            chunks = [
                json.loads(chunk)
                async for chunk in AgentService.chat_stream(
                    agent_code="000001",
                    text="生成 Word 和 PDF",
                )
            ]

        file_node = [
            item["node"]
            for item in chunks
            if item.get("node", {}).get("id") == "skill-artifact-generator"
        ][-1]
        self.assertEqual(file_node["status"], "error")
        self.assertEqual(file_node["fileUrl"], "")
        self.assertEqual(file_node["details"]["files"], [])
        self.assertEqual(len(file_node["details"]["errors"]), 2)
        self.assertFalse(any(item.get("event") == "artifact" for item in chunks))

    async def test_memory_is_injected_without_writing_conversation(self):
        from agent.agent_service import AgentService

        config = {
            "agent_code": "000001",
            "agent_name": "测试智能体",
            "model_type": "ollama",
            "model_name": "test",
            "base_url": "",
            "support_file": False,
            "support_think": False,
            "support_connect": False,
            "support_knowledge": False,
        }
        captured_messages = []

        async def fake_model_stream(
            _config, _text, _thinking, _connect, base_messages, context
        ):
            captured_messages.extend(base_messages)
            yield AgentService._event(
                config, event="message", content="回答", **context
            )
            yield AgentService._step(
                config, "model_call", "completed", "模型调用完成", **context
            )

        with (
            patch.object(AgentService, "get_agent_config", return_value=config),
            patch.object(
                AgentService,
                "_chat_stream_ollama",
                side_effect=fake_model_stream,
            ),
            patch(
                "services.memory_service.is_memory_enabled",
                return_value=True,
            ),
            patch(
                "services.memory_service.search_memory",
                return_value={
                    "code": 0,
                    "data": {"memory_detail_list": [{"memory_value": "偏好中文"}]},
                },
            ),
            patch(
                "services.memory_service.add_memory",
                return_value={"code": 0, "message": "success"},
            ) as add_memory_mock,
        ):
            chunks = [
                json.loads(chunk)
                async for chunk in AgentService.chat_stream(
                    agent_code="000001",
                    text="你好",
                    username="10001",
                    session_id=None,
                )
            ]

        self.assertTrue(any("偏好中文" in item["content"] for item in captured_messages))
        self.assertTrue(any(item.get("event") == "node" for item in chunks))
        self.assertEqual(chunks[-1]["event"], "done")
        self.assertTrue(chunks[-1]["memory"])
        self.assertFalse(
            any(
                item.get("node", {}).get("name") == "memory_write"
                for item in chunks
            )
        )
        add_memory_mock.assert_not_called()

    async def test_forced_search_skills_emit_nodes_and_feed_model_context(self):
        from agent.agent_service import AgentService

        config = {
            "agent_code": "000001",
            "agent_name": "测试智能体",
            "model_type": "ollama",
            "model_name": "test",
            "base_url": "",
            "support_file": True,
            "support_think": False,
            "support_connect": True,
            "support_knowledge": True,
        }
        execution_order = []
        captured_messages = []

        def execute_skill(name, **_):
            execution_order.append(name)
            if name == "web-search":
                return {"context": "联网结果", "items": [{"title": "网页"}]}
            return {
                "context": "知识内容",
                "items": [{"fileId": "knowledge-1"}],
            }

        async def fake_model_stream(
            _config, _text, _thinking, _connect, base_messages, context
        ):
            captured_messages.extend(base_messages)
            yield AgentService._event(
                config, event="message", content="综合回答", **context
            )
            yield AgentService._step(
                config,
                "model_call",
                "completed",
                "模型调用完成",
                node_id="model-call-1",
                node_kind="model",
                **context,
            )

        with (
            patch.object(AgentService, "get_agent_config", return_value=config),
            patch.object(AgentService, "_chat_stream_ollama", side_effect=fake_model_stream),
            patch("services.skill_service.SkillService.execute", side_effect=execute_skill),
            patch("services.memory_service.is_memory_enabled", return_value=False),
        ):
            chunks = [
                json.loads(chunk)
                async for chunk in AgentService.chat_stream(
                    agent_code="000001",
                    text="查询",
                    skills=["web-search", "knowledge-search"],
                )
            ]

        self.assertEqual(execution_order, ["web-search", "knowledge-search"])
        self.assertTrue(any("联网结果" in item["content"] for item in captured_messages))
        self.assertTrue(any("知识内容" in item["content"] for item in captured_messages))
        node_ids = {item["node"]["id"] for item in chunks if item.get("node")}
        self.assertIn("skill-web-search", node_ids)
        self.assertIn("skill-knowledge-search", node_ids)
        self.assertIn("model-call-1", node_ids)

    async def test_skill_failure_does_not_prevent_model_answer(self):
        from agent.agent_service import AgentService

        config = {
            "agent_code": "000001",
            "agent_name": "测试智能体",
            "model_type": "ollama",
            "model_name": "test",
            "base_url": "",
            "support_file": False,
            "support_think": False,
            "support_connect": True,
            "support_knowledge": False,
        }

        async def fake_model_stream(
            _config, _text, _thinking, _connect, _base_messages, context
        ):
            yield AgentService._event(
                config, event="message", content="降级回答", **context
            )
            yield AgentService._step(
                config,
                "model_call",
                "completed",
                "模型调用完成",
                node_id="model-call-1",
                node_kind="model",
                **context,
            )

        with (
            patch.object(AgentService, "get_agent_config", return_value=config),
            patch.object(AgentService, "_chat_stream_ollama", side_effect=fake_model_stream),
            patch("services.skill_service.SkillService.execute", side_effect=RuntimeError("搜索不可用")),
            patch("services.memory_service.is_memory_enabled", return_value=False),
        ):
            chunks = [
                json.loads(chunk)
                async for chunk in AgentService.chat_stream(
                    agent_code="000001",
                    text="查询",
                    skills=["web-search"],
                )
            ]
        self.assertTrue(any(item.get("content") == "降级回答" for item in chunks))
        self.assertTrue(
            any(
                item.get("node", {}).get("id") == "skill-web-search"
                and item["node"]["status"] == "error"
                for item in chunks
            )
        )
        self.assertEqual(chunks[-1]["event"], "done")


if __name__ == "__main__":
    unittest.main()
