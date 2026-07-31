import os

from dotenv import load_dotenv


load_dotenv()


def get_required_env(name: str) -> str:
    value = os.getenv(name)
    if value is None or not value.strip():
        raise ValueError(f"{name} 未配置，请检查 .env 文件")
    return value.strip()


def get_int_env(name: str) -> int:
    value = get_required_env(name)
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(f"{name} 必须是整数，当前值: {value}") from exc


def get_float_env(name: str) -> float:
    value = get_required_env(name)
    try:
        return float(value)
    except ValueError as exc:
        raise ValueError(f"{name} 必须是数字，当前值: {value}") from exc
