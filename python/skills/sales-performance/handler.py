import json
import re
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Iterable, List, Tuple

from sqlalchemy import text

from db.sqlalchemy_connection import get_engine, get_session
from models.db_models import User


SELF_WORDS = ("我", "本人", "自己", "我的", "本人的", "自己的")
HALF_YEAR_PATTERN = re.compile(
    r"(?:(?P<year>20\d{2})\s*年\s*|(?P<this_year>今年)\s*)?"
    r"(?P<period>上半年|下半年|全年)"
)
QUARTER_PATTERN = re.compile(
    r"(?:(?P<year>20\d{2})\s*年\s*|(?P<this_year>今年)\s*)?"
    r"(?:(?:第?\s*(?<!\d)(?P<quarter_cn>[一二三四1234])(?!\d)\s*季度)|"
    r"(?:[Qq]\s*(?P<quarter_q>[1-4])(?!\d)))"
)
MONTH_PATTERN = re.compile(
    r"(?:(?P<year>20\d{2})\s*年\s*|(?P<this_year>今年)\s*)?"
    r"(?<!\d)(?P<month>1[0-2]|0?[1-9])(?!\d)\s*月份?"
)
TIME_EXPRESSION_PATTERN = re.compile(
    r"(?:(?:20\d{2})\s*年\s*|今年\s*)?"
    r"(?:上半年|下半年|全年|第?\s*[一二三四1234]\s*季度|"
    r"[Qq]\s*[1-4]|(?:1[0-2]|0?[1-9])\s*月份?)"
)
QUERY_PREFIX_PATTERN = re.compile(r"^(?:请|帮我|麻烦)?(?:查询|查一下|查|查看|统计)?")
SALES_WORD_PATTERN = re.compile(
    r"(?:的|在)?(?:的)?(?:销售额|营业额|销售业绩|业绩)"
)


def _direct_response(message: str, status: str) -> dict:
    return {
        "status": status,
        "directResponse": message,
        "stopPipeline": True,
        "summary": message,
    }


def _format_decimal(value: Decimal) -> str:
    formatted = format(value, "f")
    if "." in formatted:
        formatted = formatted.rstrip("0").rstrip(".")
    return formatted or "0"


def _period(query: str) -> Tuple[int, str, int, int, str] | None:
    match = HALF_YEAR_PATTERN.search(query or "")
    if match:
        year = int(match.group("year")) if match.group("year") else date.today().year
        period = match.group("period")
        start_month, end_month = {
            "上半年": (1, 6),
            "下半年": (7, 12),
            "全年": (1, 12),
        }[period]
        return year, period, start_month, end_month, f"{year}年{period}"

    match = QUARTER_PATTERN.search(query or "")
    if match:
        year = int(match.group("year")) if match.group("year") else date.today().year
        quarter_value = match.group("quarter_cn") or match.group("quarter_q")
        quarter = {
            "一": 1,
            "二": 2,
            "三": 3,
            "四": 4,
            "1": 1,
            "2": 2,
            "3": 3,
            "4": 4,
        }[quarter_value]
        start_month = (quarter - 1) * 3 + 1
        end_month = start_month + 2
        period = ("第一季度", "第二季度", "第三季度", "第四季度")[quarter - 1]
        return year, period, start_month, end_month, f"{year}年{period}"

    match = MONTH_PATTERN.search(query or "")
    if not match:
        return None
    year = int(match.group("year")) if match.group("year") else date.today().year
    month = int(match.group("month"))
    period = f"{month}月"
    return year, period, month, month, f"{year}年{period}"


def _has_self_reference(query: str) -> bool:
    return any(word in (query or "") for word in SELF_WORDS)


def _has_explicit_target(query: str, period_label: str) -> bool:
    text_value = QUERY_PREFIX_PATTERN.sub("", (query or "").strip())
    text_value = text_value.replace(period_label, "")
    text_value = TIME_EXPRESSION_PATTERN.sub("", text_value)
    text_value = SALES_WORD_PATTERN.sub("", text_value)
    text_value = re.sub(r"[，,。.!！?？的在\s\"'“”‘’]", "", text_value)
    return bool(text_value)


def _load_requester(requester_username: str):
    session = None
    try:
        session = get_session("agent-user")
        return session.query(User).filter_by(username=requester_username).first()
    finally:
        if session:
            session.close()


def _resolve_admin_target(query: str):
    session = None
    try:
        session = get_session("agent-user")
        users = (
            session.query(User)
            .filter(User.nickname.isnot(None), User.nickname != "")
            .all()
        )
        matches = [user for user in users if user.nickname and user.nickname in query]
        if not matches:
            return None, "未找到对应用户，请确认昵称"

        longest = max(len(user.nickname) for user in matches)
        matches = [user for user in matches if len(user.nickname) == longest]
        nicknames = {user.nickname for user in matches}
        if len(matches) != 1 or len(nicknames) != 1:
            return None, "昵称不唯一，无法确定查询用户"
        return matches[0], None
    finally:
        if session:
            session.close()


def _parse_sale_json(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        value = json.loads(raw)
        if isinstance(value, dict):
            return value
    raise ValueError("sale 字段不是有效的 JSON 对象")


def _parse_sale_date(value: Any) -> datetime:
    text_value = str(value)
    for date_format in ("%Y-%m-%d", "%Y-%m"):
        try:
            return datetime.strptime(text_value, date_format)
        except ValueError:
            continue
    raise ValueError(f"不支持的销售日期格式: {text_value}")


def _aggregate_sales(
    sales: Iterable[Any],
    year: int,
    start_month: int,
    end_month: int,
) -> Tuple[List[Dict[str, str]], Decimal, List[str]]:
    monthly: Dict[str, Decimal] = defaultdict(Decimal)
    warnings: List[str] = []
    for raw in sales:
        try:
            items = _parse_sale_json(raw).items()
        except (TypeError, ValueError, json.JSONDecodeError) as exc:
            warnings.append(str(exc))
            continue
        for raw_date, raw_value in items:
            try:
                sale_date = _parse_sale_date(raw_date)
                amount = Decimal(str(raw_value))
                if not amount.is_finite():
                    raise ValueError(f"销售金额不是有限数值: {raw_value}")
            except (InvalidOperation, TypeError, ValueError) as exc:
                warnings.append(str(exc))
                continue
            if sale_date.year == year and start_month <= sale_date.month <= end_month:
                monthly[f"{sale_date.year:04d}-{sale_date.month:02d}"] += amount

    items = [
        {"month": month, "value": _format_decimal(amount)}
        for month, amount in sorted(monthly.items())
    ]
    return items, sum(monthly.values(), Decimal("0")), warnings


def _artifact_content(data: Dict[str, Any]) -> str:
    lines = [
        f'# {data["nickname"]} {data["periodLabel"]}销售业绩',
        "",
        f'总营业额：{data["total"]}',
        "",
        "| 月份 | 营业额 |",
        "| --- | ---: |",
    ]
    lines.extend(
        f'| {item["month"]} | {item["value"]} |'
        for item in data["monthly"]
    )
    return "\n".join(lines)


def execute(
    query: str,
    requester_username: str | None = None,
    **_,
) -> dict:
    if not requester_username:
        return _direct_response("请先登录后查询销售业绩", "unauthenticated")

    requester = _load_requester(requester_username)
    if not requester:
        return _direct_response("请先登录后查询销售业绩", "unauthenticated")

    period = _period(query)
    if not period:
        return _direct_response(
            "请明确查询月份、季度、上半年、下半年或全年，可同时指定年份",
            "invalid_request",
        )
    year, period_name, start_month, end_month, period_label = period

    role = (requester.role or "").lower()
    if role == "user":
        own_nickname = requester.nickname or ""
        is_self = (
            _has_self_reference(query)
            or (own_nickname and own_nickname in query)
            or not _has_explicit_target(query, period_label)
        )
        if not is_self:
            return _direct_response("权限不足", "forbidden")
        target = requester
    elif role == "admin":
        if _has_self_reference(query):
            target = requester
        else:
            target, error = _resolve_admin_target(query)
            if error:
                return _direct_response(error, "not_found")
    else:
        return _direct_response("权限不足", "forbidden")

    connection = get_engine("simulated-data").connect()
    try:
        rows = connection.execute(
            text(
                "SELECT sale FROM sales_performance "
                "WHERE username = :username ORDER BY id"
            ),
            {"username": target.username},
        ).all()
    finally:
        connection.close()

    monthly, total, warnings = _aggregate_sales(
        (row[0] for row in rows),
        year,
        start_month,
        end_month,
    )
    target_label = target.nickname or "本人"
    if not monthly:
        return _direct_response(
            f"未查询到{target_label}在{period_label}的营业额数据",
            "no_data",
        )

    data = {
        "nickname": target_label,
        "year": year,
        "period": period_name,
        "periodLabel": period_label,
        "total": _format_decimal(total),
        "monthly": monthly,
        "warnings": warnings,
    }
    artifact_content = _artifact_content(data)
    return {
        "status": "success",
        "data": data,
        "presentation": artifact_content,
        "artifactContent": artifact_content,
        "context": (
            f"已授权的销售业绩数据：对象为{target_label}，期间为{period_label}，"
            f"总营业额为{data['total']}，月度数据为"
            f"{json.dumps(monthly, ensure_ascii=False)}。"
            "请只给出一至三条由这些数据直接支持的趋势解读，"
            "不要暴露内部账号，不要修改或虚构金额。"
        ),
        "summary": f"已查询{target_label}{period_label}销售业绩",
    }
