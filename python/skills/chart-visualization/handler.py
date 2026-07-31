from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List


CHART_KEYWORDS = (
    ("column", ("柱状图", "柱形图")),
    ("bar", ("条形图",)),
    ("area", ("面积图",)),
    ("pie", ("饼图",)),
    ("table", ("可视化表格",)),
    ("line", ("折线图", "趋势图")),
)


def _chart_type(query: str) -> str:
    normalized = query or ""
    for chart_type, keywords in CHART_KEYWORDS:
        if any(keyword in normalized for keyword in keywords):
            return chart_type
    return "line"


def _number(value: Any) -> str:
    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"图表数值无效: {value}") from exc
    if not number.is_finite():
        raise ValueError(f"图表数值无效: {value}")
    formatted = format(number, "f")
    if "." in formatted:
        formatted = formatted.rstrip("0").rstrip(".")
    return formatted or "0"


def _quoted(value: Any) -> str:
    return str(value).replace("\\", "\\\\").replace('"', '\\"')


def _render_chart(
    chart_type: str,
    monthly: List[Dict[str, Any]],
    title: str,
) -> str:
    category_field = chart_type in {"column", "bar", "pie", "table"}
    lines = [f"```vis {chart_type}", "data"]
    for item in monthly:
        key = "category" if category_field else "time"
        lines.append(f'  - {key} "{_quoted(item["month"])}"')
        lines.append(f'    value {_number(item["value"])}')
    lines.append(f'title "{_quoted(title)}"')
    if chart_type != "pie":
        lines.append('axisXTitle "月份"')
        lines.append('axisYTitle "营业额"')
    lines.append("```")
    return "\n".join(lines)


def execute(
    query: str,
    upstream_data: Dict[str, Any] | None = None,
    **_,
) -> dict:
    data = upstream_data or {}
    monthly = data.get("monthly") or []
    if not monthly:
        raise ValueError("没有可用于生成图表的销售数据")

    chart_type = _chart_type(query)
    target = data.get("nickname") or "本人"
    period_label = data.get("periodLabel") or "销售业绩"
    title = f"{target} {period_label}营业额"
    presentation = _render_chart(chart_type, monthly, title)
    return {
        "status": "success",
        "data": data,
        "presentation": presentation,
        "context": (
            "图表已经根据授权后的月度营业额确定性生成。"
            "请仅补充一至三条简短趋势解读，不要重新生成图表，"
            "不要修改、补齐或虚构任何金额。"
        ),
        "summary": f"已生成{title}{chart_type}图表",
    }
