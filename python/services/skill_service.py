import os
import re
import importlib.util
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional
from urllib.parse import urlparse


@dataclass(frozen=True)
class SkillDefinition:
    name: str
    description: str
    prompt: str
    path: Path
    file_extensions: List[str] = field(default_factory=list)
    intent_keywords: List[str] = field(default_factory=list)
    artifact: Optional[str] = None
    entrypoint: Optional[str] = None
    order: int = 100
    kind: str = "prompt"


class SkillService:
    """从 python/skills 目录发现并选择技能。"""

    _cache: Optional[Dict[str, SkillDefinition]] = None

    @classmethod
    def skills_dir(cls) -> Path:
        configured = os.getenv("AGENT_SKILLS_DIR")
        return Path(configured) if configured else Path(__file__).resolve().parents[1] / "skills"

    @staticmethod
    def _parse_frontmatter(content: str) -> tuple[Dict[str, str], str]:
        if not content.startswith("---"):
            return {}, content.strip()
        match = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", content, re.S)
        if not match:
            return {}, content.strip()

        metadata: Dict[str, str] = {}
        for line in match.group(1).splitlines():
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            metadata[key.strip()] = value.strip().strip("\"'")
        return metadata, match.group(2).strip()

    @staticmethod
    def _csv(value: str) -> List[str]:
        return [item.strip().lower() for item in value.split(",") if item.strip()]

    @classmethod
    def load_skills(cls, refresh: bool = False) -> Dict[str, SkillDefinition]:
        if cls._cache is not None and not refresh:
            return cls._cache

        skills: Dict[str, SkillDefinition] = {}
        root = cls.skills_dir()
        if root.exists():
            for skill_file in sorted(root.glob("*/SKILL.md")):
                content = skill_file.read_text(encoding="utf-8")
                metadata, prompt = cls._parse_frontmatter(content)
                name = metadata.get("name") or skill_file.parent.name
                skills[name] = SkillDefinition(
                    name=name,
                    description=metadata.get("description", ""),
                    prompt=prompt,
                    path=skill_file,
                    file_extensions=cls._csv(metadata.get("file_extensions", "")),
                    intent_keywords=cls._csv(metadata.get("intent_keywords", "")),
                    artifact=metadata.get("artifact") or None,
                    entrypoint=metadata.get("entrypoint") or None,
                    order=int(metadata.get("order", "100")),
                    kind=metadata.get("kind", "prompt"),
                )
        cls._cache = skills
        return skills

    @staticmethod
    def _file_extension(url: str) -> str:
        return Path(urlparse(url).path).suffix.lower()

    @classmethod
    def select_skill(
        cls,
        text: str,
        files: List[str],
        requested_skill: Optional[str] = None,
    ) -> Optional[SkillDefinition]:
        skills = cls.load_skills()
        if requested_skill:
            skill = skills.get(requested_skill)
            if not skill:
                raise ValueError(f"技能不存在: {requested_skill}")
            return skill

        normalized_text = (text or "").lower()
        extensions = {cls._file_extension(url) for url in files}
        for skill in skills.values():
            if skill.kind != "prompt":
                continue
            file_matches = not skill.file_extensions or bool(
                extensions.intersection(skill.file_extensions)
            )
            intent_matches = bool(skill.intent_keywords) and any(
                keyword in normalized_text for keyword in skill.intent_keywords
            )
            if file_matches and intent_matches:
                return skill
        return None

    @classmethod
    def get_skill(cls, name: str) -> SkillDefinition:
        skill = cls.load_skills().get(name)
        if not skill:
            raise ValueError(f"技能不存在: {name}")
        return skill

    @classmethod
    def get_handler(cls, skill: SkillDefinition) -> Callable[..., Dict[str, Any]]:
        if not skill.entrypoint:
            raise ValueError(f"技能未配置执行入口: {skill.name}")
        module_file, function_name = skill.entrypoint.split(":", 1)
        module_path = skill.path.parent / module_file
        if not module_path.exists():
            raise ValueError(f"技能入口不存在: {module_path}")
        module_name = f"agent_skill_{skill.name.replace('-', '_')}"
        spec = importlib.util.spec_from_file_location(module_name, module_path)
        if not spec or not spec.loader:
            raise ValueError(f"无法加载技能: {skill.name}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        handler = getattr(module, function_name, None)
        if not callable(handler):
            raise ValueError(f"技能入口不可调用: {skill.entrypoint}")
        return handler

    @classmethod
    def execute(cls, name: str, **kwargs) -> Dict[str, Any]:
        skill = cls.get_skill(name)
        handler = cls.get_handler(skill)
        result = handler(**kwargs)
        if not isinstance(result, dict):
            raise ValueError(f"技能返回值必须是字典: {name}")
        return result

    @staticmethod
    def detect_artifact_formats(
        text: str, explicit_format: Optional[str] = None
    ) -> List[str]:
        supported = {"docx", "xlsx", "pptx", "pdf"}
        if explicit_format:
            requested = [
                item.strip().lower().lstrip(".")
                for item in re.split(r"[,，\s]+", explicit_format)
                if item.strip()
            ]
            return list(dict.fromkeys(item for item in requested if item in supported))

        normalized = (text or "").lower()
        rules = (
            (
                "docx",
                (
                    "docx",
                    "word",
                    "生成文档",
                    "输出文档",
                    "导出文档",
                    "生成报告",
                    "制作报告",
                    "写一份报告",
                    "报告文件",
                    "生成文件",
                ),
            ),
            ("xlsx", ("xlsx", "excel", "电子表格", "工作簿", "表格文件", "生成表格", "导出表格")),
            ("pptx", ("pptx", "ppt", "powerpoint", "演示文稿", "幻灯片", "制作ppt")),
            ("pdf", ("pdf", "便携文档", "生成pdf", "导出pdf")),
        )
        formats = [
            artifact_format
            for artifact_format, keywords in rules
            if any(keyword in normalized for keyword in keywords)
        ]
        return list(dict.fromkeys(formats))

    @classmethod
    def detect_artifact_format(
        cls, text: str, explicit_format: Optional[str] = None
    ) -> Optional[str]:
        """兼容旧调用方：返回第一个命中的产物格式。"""
        formats = cls.detect_artifact_formats(text, explicit_format)
        return formats[0] if formats else None
