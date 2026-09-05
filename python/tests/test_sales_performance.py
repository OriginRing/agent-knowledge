import json
import unittest
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from services.skill_service import SkillService


class FakeConnection:
    def __init__(self, rows):
        self.rows = rows
        self.closed = False
        self.params = None

    def execute(self, _statement, params):
        self.params = params
        return SimpleNamespace(all=lambda: self.rows)

    def close(self):
        self.closed = True


class FakeEngine:
    def __init__(self, rows):
        self.connection = FakeConnection(rows)

    def connect(self):
        return self.connection


class SalesPerformanceSkillTest(unittest.TestCase):
    def setUp(self):
        SkillService._cache = None
        skill = SkillService.get_skill("sales-performance")
        self.handler = SkillService.get_handler(skill)
        self.module_globals = self.handler.__globals__

    def tearDown(self):
        SkillService._cache = None

    def test_sales_skill_allows_other_agents(self):
        skill = SkillService.get_skill('sales-performance')
        self.assertEqual(skill.agent_codes, [])
        SkillService.ensure_agent_allowed(skill, '400001')
        with patch.object(SkillService, 'get_handler', return_value=lambda **kwargs: {'user': kwargs['requester_username']}):
            result = SkillService.execute('sales-performance', agent_code='400001', query='查询', requester_username='100001')
            self.assertEqual(result['user'], '100001')

    def test_aggregate_supports_month_and_day_keys(self):
        aggregate = self.module_globals["_aggregate_sales"]
        monthly, total, warnings = aggregate(
            [
                {
                    "2026-01": "10.25",
                    "2026-01-15": 2,
                    "2026-06-30": "7.75",
                    "2026-07": 99,
                    "invalid": 100,
                }
            ],
            2026,
            1,
            6,
        )
        self.assertEqual(
            monthly,
            [
                {"month": "2026-01", "value": "12.25"},
                {"month": "2026-06", "value": "7.75"},
            ],
        )
        self.assertEqual(total, Decimal("20.00"))
        self.assertEqual(len(warnings), 1)

    def test_user_can_query_self_with_implicit_current_year(self):
        current_year = date.today().year
        requester = SimpleNamespace(
            username="100001",
            nickname="小李",
            role="user",
        )
        engine = FakeEngine(
            [
                (
                    {
                        f"{current_year}-01": 100,
                        f"{current_year}-06-15": "25.5",
                    },
                )
            ]
        )
        with patch.dict(
            self.module_globals,
            {
                "_load_requester": lambda _: requester,
                "get_engine": lambda _: engine,
            },
        ):
            result = self.handler(
                query="查我上半年营业额",
                requester_username="100001",
            )

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["data"]["total"], "125.5")
        self.assertEqual(result["data"]["periodLabel"], f"{current_year}年上半年")
        self.assertNotIn("100001", json.dumps(result, ensure_ascii=False))
        self.assertEqual(engine.connection.params, {"username": "100001"})

    def test_period_parser_supports_single_month_and_quarter_aliases(self):
        parse_period = self.module_globals["_period"]
        current_year = date.today().year

        cases = [
            ("查询2026年3月份营业额", (2026, "3月", 3, 3, "2026年3月")),
            (
                "查询2026年第一季度营业额",
                (2026, "第一季度", 1, 3, "2026年第一季度"),
            ),
            (
                "查询2026年Q2营业额",
                (2026, "第二季度", 4, 6, "2026年第二季度"),
            ),
            (
                "查询三季度营业额",
                (current_year, "第三季度", 7, 9, f"{current_year}年第三季度"),
            ),
        ]
        for query, expected in cases:
            with self.subTest(query=query):
                self.assertEqual(parse_period(query), expected)
        self.assertIsNone(parse_period("查询2026年13月营业额"))
        self.assertIsNone(parse_period("查询2026年第12季度营业额"))

    def test_user_can_query_single_month_without_explicit_self_word(self):
        current_year = date.today().year
        requester = SimpleNamespace(
            username="100001",
            nickname="小李",
            role="user",
        )
        engine = FakeEngine(
            [
                (
                    {
                        f"{current_year}-03": "10.25",
                        f"{current_year}-03-15": "2.75",
                        f"{current_year}-04": 99,
                    },
                )
            ]
        )
        with patch.dict(
            self.module_globals,
            {
                "_load_requester": lambda _: requester,
                "get_engine": lambda _: engine,
            },
        ):
            result = self.handler(
                query="查询今年3月份营业额",
                requester_username="100001",
            )

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["data"]["periodLabel"], f"{current_year}年3月")
        self.assertEqual(result["data"]["monthly"], [
            {"month": f"{current_year}-03", "value": "13"},
        ])
        self.assertEqual(result["data"]["total"], "13")

    def test_quarter_query_uses_exact_three_month_boundary(self):
        requester = SimpleNamespace(
            username="900001",
            nickname="管理员",
            role="admin",
        )
        target = SimpleNamespace(
            username="100002",
            nickname="小王",
            role="user",
        )
        engine = FakeEngine(
            [({"2026-03": 100, "2026-04": 10, "2026-06": 20, "2026-07": 200},)]
        )
        with patch.dict(
            self.module_globals,
            {
                "_load_requester": lambda _: requester,
                "_resolve_admin_target": lambda _: (target, None),
                "get_engine": lambda _: engine,
            },
        ):
            result = self.handler(
                query="查询小王2026年第二季度营业额",
                requester_username="900001",
            )

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["data"]["periodLabel"], "2026年第二季度")
        self.assertEqual(
            result["data"]["monthly"],
            [
                {"month": "2026-04", "value": "10"},
                {"month": "2026-06", "value": "20"},
            ],
        )
        self.assertEqual(result["data"]["total"], "30")

    def test_user_querying_another_person_is_denied_before_sales_lookup(self):
        requester = SimpleNamespace(
            username="100001",
            nickname="小李",
            role="user",
        )

        def forbidden_engine(_):
            raise AssertionError("越权请求不应访问销售数据库")

        with patch.dict(
            self.module_globals,
            {
                "_load_requester": lambda _: requester,
                "get_engine": forbidden_engine,
            },
        ):
            result = self.handler(
                query="查询小王2026年上半年营业额",
                requester_username="100001",
            )

        self.assertEqual(result["status"], "forbidden")
        self.assertEqual(result["directResponse"], "权限不足")
        self.assertTrue(result["stopPipeline"])

    def test_admin_can_query_another_user_by_nickname(self):
        requester = SimpleNamespace(
            username="900001",
            nickname="管理员",
            role="admin",
        )
        target = SimpleNamespace(
            username="100002",
            nickname="小王",
            role="user",
        )
        engine = FakeEngine([({"2026-07": 30, "2026-12-15": 70},)])
        with patch.dict(
            self.module_globals,
            {
                "_load_requester": lambda _: requester,
                "_resolve_admin_target": lambda _: (target, None),
                "get_engine": lambda _: engine,
            },
        ):
            result = self.handler(
                query="查询小王2026年下半年营业额",
                requester_username="900001",
            )

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["data"]["nickname"], "小王")
        self.assertEqual(result["data"]["total"], "100")
        self.assertEqual(engine.connection.params, {"username": "100002"})

    def test_unauthenticated_request_stops_immediately(self):
        result = self.handler(
            query="查我上半年营业额",
            requester_username=None,
        )
        self.assertEqual(result["status"], "unauthenticated")
        self.assertEqual(result["directResponse"], "请先登录后查询销售业绩")

    def test_empty_period_data_does_not_generate_downstream_content(self):
        requester = SimpleNamespace(
            username="100001",
            nickname="小李",
            role="user",
        )
        engine = FakeEngine([({"2025-01": 100},)])
        with patch.dict(
            self.module_globals,
            {
                "_load_requester": lambda _: requester,
                "get_engine": lambda _: engine,
            },
        ):
            result = self.handler(
                query="查我2026年上半年营业额",
                requester_username="100001",
            )

        self.assertEqual(result["status"], "no_data")
        self.assertTrue(result["stopPipeline"])
        self.assertNotIn("presentation", result)


class SalesChartSkillTest(unittest.TestCase):
    def setUp(self):
        SkillService._cache = None
        skill = SkillService.get_skill("chart-visualization")
        self.handler = SkillService.get_handler(skill)

    def tearDown(self):
        SkillService._cache = None

    def test_structured_sales_data_renders_exact_requested_chart(self):
        result = self.handler(
            query="请用柱状图展示",
            upstream_data={
                "nickname": "小王",
                "periodLabel": "2026年上半年",
                "monthly": [
                    {"month": "2026-01", "value": "12.25"},
                    {"month": "2026-02", "value": "30"},
                ],
            },
        )
        presentation = result["presentation"]
        self.assertIn("```vis column", presentation)
        self.assertIn('category "2026-01"', presentation)
        self.assertIn("value 12.25", presentation)
        self.assertNotIn("| 月份 |", presentation)

    def test_monthly_sales_defaults_to_line_chart(self):
        result = self.handler(
            query="可视化展示",
            upstream_data={
                "nickname": "小王",
                "periodLabel": "2026年上半年",
                "monthly": [{"month": "2026-01", "value": "10"}],
            },
        )
        self.assertIn("```vis line", result["presentation"])

class SalesAgentPipelineTest(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def _config():
        return {
            "agent_code": "300001",
            "agent_name": "销售业绩助手",
            "model_type": "ollama",
            "model_name": "qwen3.5:9b",
            "base_url": "",
            "default_skill": "sales-performance",
            "support_file": False,
            "support_think": False,
            "support_download": True,
        }

    async def test_sales_chart_and_export_execute_in_order(self):
        from agent.agent_service import AgentService

        config = self._config()
        execution_order = []
        artifact_inputs = []
        sales_data = {
            "nickname": "小王",
            "periodLabel": "2026年上半年",
            "total": "30",
            "monthly": [
                {"month": "2026-01", "value": "10"},
                {"month": "2026-02", "value": "20"},
            ],
        }
        canonical = (
            "# 小王 2026年上半年销售业绩\n\n"
            "总营业额：30\n\n"
            "| 月份 | 营业额 |\n| --- | ---: |\n"
            "| 2026-01 | 10 |\n| 2026-02 | 20 |"
        )

        def execute_skill(name, **kwargs):
            execution_order.append(name)
            if name == "sales-performance":
                return {
                    "status": "success",
                    "data": sales_data,
                    "presentation": canonical,
                    "artifactContent": canonical,
                    "context": "授权销售数据",
                    "summary": "销售查询完成",
                }
            if name == "chart-visualization":
                self.assertEqual(kwargs["upstream_data"], sales_data)
                return {
                    "status": "success",
                    "data": sales_data,
                    "presentation": (
                        "```vis column\n"
                        "data\n"
                        '  - category "2026-01"\n'
                        "    value 10\n"
                        "```"
                    ),
                    "context": "只输出趋势解读",
                    "summary": "图表生成完成",
                }
            artifact_inputs.append(kwargs["content"])
            return {
                "id": "sales-xlsx",
                "type": "file",
                "format": "xlsx",
                "mimeType": "application/octet-stream",
                "name": "销售业绩.xlsx",
                "url": "https://oss.example/sales.xlsx",
                "size": 1024,
            }

        async def fake_model_stream(
            _config, _text, _thinking, base_messages, context
        ):
            self.assertTrue(
                any("只输出趋势解读" in item["content"] for item in base_messages)
            )
            yield AgentService._event(
                config,
                event="message",
                content="### 趋势解读\n\n- 二月高于一月。",
                **context,
            )

        with (
            patch.object(AgentService, "get_agent_config", return_value=config),
            patch.object(
                AgentService,
                "_chat_stream_ollama",
                side_effect=fake_model_stream,
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
                    agent_code="300001",
                    text="查询小王2026年上半年营业额，用柱状图展示并导出 Excel",
                    username="900001",
                )
            ]

        self.assertEqual(
            execution_order,
            ["sales-performance", "chart-visualization", "artifact-generator"],
        )
        visible_content = "".join(
            item.get("content", "")
            for item in chunks
            if item.get("event") == "message"
        )
        self.assertIn("```vis column", visible_content)
        self.assertIn("趋势解读", visible_content)
        self.assertNotIn("| 月份 |", visible_content)
        self.assertEqual(artifact_inputs, [canonical])
        self.assertEqual(chunks[-1]["event"], "done")
        self.assertEqual(len(chunks[-1]["artifacts"]), 1)

    async def test_permission_denial_stops_downstream_skills_and_model(self):
        from agent.agent_service import AgentService

        config = self._config()
        execution_order = []

        def execute_skill(name, **_):
            execution_order.append(name)
            return {
                "status": "forbidden",
                "directResponse": "权限不足",
                "stopPipeline": True,
                "summary": "权限不足",
            }

        with (
            patch.object(AgentService, "get_agent_config", return_value=config),
            patch.object(AgentService, "_chat_stream_ollama") as model_mock,
            patch(
                "services.skill_service.SkillService.execute",
                side_effect=execute_skill,
            ),
            patch("services.memory_service.is_memory_enabled", return_value=False),
        ):
            chunks = [
                json.loads(chunk)
                async for chunk in AgentService.chat_stream(
                    agent_code="300001",
                    text="查询小王2026年上半年营业额并生成图表",
                    username="100001",
                )
            ]

        self.assertEqual(execution_order, ["sales-performance"])
        model_mock.assert_not_called()
        self.assertTrue(
            any(item.get("content") == "权限不足" for item in chunks)
        )
        self.assertEqual(chunks[-1]["event"], "done")

    async def test_model_failure_keeps_exact_sales_presentation(self):
        from agent.agent_service import AgentService

        config = self._config()
        canonical = (
            "# 小王 2026年上半年销售业绩\n\n"
            "总营业额：30\n\n"
            "| 月份 | 营业额 |\n| --- | ---: |\n| 2026-01 | 30 |"
        )

        def execute_skill(name, **_):
            self.assertEqual(name, "sales-performance")
            return {
                "status": "success",
                "data": {
                    "nickname": "小王",
                    "periodLabel": "2026年上半年",
                    "total": "30",
                    "monthly": [{"month": "2026-01", "value": "30"}],
                },
                "presentation": canonical,
                "artifactContent": canonical,
                "context": "授权销售数据",
                "summary": "销售查询完成",
            }

        async def failing_model(*_args, **_kwargs):
            if False:
                yield None
            raise RuntimeError("模型不可用")

        with (
            patch.object(AgentService, "get_agent_config", return_value=config),
            patch.object(
                AgentService,
                "_chat_stream_ollama",
                side_effect=failing_model,
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
                    agent_code="300001",
                    text="查询小王2026年上半年营业额",
                    username="900001",
                )
            ]

        visible_content = "".join(
            item.get("content", "")
            for item in chunks
            if item.get("event") == "message"
        )
        self.assertIn(canonical, visible_content)
        self.assertTrue(
            any(
                item.get("node", {}).get("id") == "model-call-1"
                and item["node"]["status"] == "error"
                for item in chunks
            )
        )
        self.assertEqual(chunks[-1]["event"], "done")


if __name__ == "__main__":
    unittest.main()
