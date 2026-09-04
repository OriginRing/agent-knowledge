import json
import uuid
import zipfile
from fastapi import APIRouter, Cookie, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.routing import APIRoute
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, Field
from db.sqlalchemy_connection import get_session
from models.db_models import User
from models.admin_models import AdminDebugRun
from services import admin_service as service
from services.user_service import decode_token
from services.workflow_service import validate_graph


def require_admin(access_token: str = Cookie(None)):
    payload = decode_token(access_token) if access_token else None
    if not payload or not payload.get('sub'):
        raise HTTPException(401, '请先登录')
    with get_session('agent-user') as session:
        user = session.query(User).filter_by(username=payload['sub']).first()
        if not user:
            raise HTTPException(401, '登录账号不存在')
        if user.role != 'admin':
            raise HTTPException(403, '需要管理员权限')
        return user.username


class AdminRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()
        async def handler(request):
            try:
                return await original(request)
            except HTTPException as exc:
                return JSONResponse(status_code=exc.status_code, content={"code": exc.status_code, "message": str(exc.detail), "data": None})
            except RequestValidationError:
                return JSONResponse(status_code=422, content={"code": 422, "message": "请求字段格式不正确", "data": None})
            except IntegrityError:
                return JSONResponse(status_code=409, content={"code": 409, "message": "记录已被并发修改，请刷新后重试", "data": None})
            except (ValueError, KeyError, TypeError, PermissionError) as exc:
                return JSONResponse(status_code=400, content={"code": 400, "message": str(exc), "data": None})
        return handler


router = APIRouter(prefix='/admin', tags=['admin'], dependencies=[Depends(require_admin)], route_class=AdminRoute)


def ok(data):
    return {'code': 0, 'message': 'success', 'data': data}


class SaveRequest(BaseModel):
    draft: dict
    revision: int | None = None


class RevisionRequest(BaseModel):
    revision: int


class DebugRequest(BaseModel):
    agentId: str
    workflowId: str | None = None
    text: str = Field(min_length=1, max_length=20000)
    files: list[str] = Field(default_factory=list)


@router.get('/me')
def me(username=Depends(require_admin)):
    return ok({'username': username, 'role': 'admin'})


@router.post('/skills/upload')
async def upload(file: UploadFile = File(...)):
    raw = await file.read(20 * 1024 * 1024 + 1)
    try:
        return ok(service.upload_skill(raw))
    except (ValueError, UnicodeError, zipfile.BadZipFile) as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post('/agents/{key}/offline')
def offline(key: str, request: RevisionRequest):
    return ok(service.offline(key, request.revision))


@router.post('/workflows/{key}/validate')
def validate(key: str):
    graph = service.detail('workflows', key)['draft']
    try:
        with get_session('agent-knowledge') as session:
            graph = service.latest_graph(session, graph)
            validate_graph(graph, lambda i, v, a: service.skill_definition(session, i, v, a))
        return ok({'valid': True})
    except (ValueError, KeyError, TypeError, PermissionError) as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post('/debug')
async def debug(request: DebugRequest, username=Depends(require_admin)):
    from services.workflow_runtime import stream_workflow
    config = service.detail('agents', request.agentId)['draft'].copy()
    if request.workflowId:
        graph = service.detail('workflows', request.workflowId)['draft']
        config['workflow'] = graph
    else:
        with get_session('agent-knowledge') as session:
            config['workflow'] = service.get_row(session, 'workflows', config.get('workflowId')).draft
    try:
        with get_session('agent-knowledge') as session:
            config['workflow'] = service.latest_graph(session, config['workflow'])
            validate_graph(config['workflow'], lambda i, v, a: service.skill_definition(session, i, v, a), config['agentCode'])
    except (ValueError, KeyError, TypeError, PermissionError) as exc:
        raise HTTPException(400, str(exc)) from exc
    config.update(agent_code=config['agentCode'], agent_name=config['name'], config_version='draft-' + uuid.uuid4().hex)
    async def events():
        history, status = [], 'cancelled'
        try:
            async for event in stream_workflow(config, text=request.text, files=request.files, username=username, memory=False):
                history.append(event)
                if event.get('done'):
                    status = 'error' if event.get('error') else 'complete'
                yield f'data: {json.dumps(event, ensure_ascii=False)}\n\n'
        finally:
            with get_session('agent-knowledge') as session, session.begin():
                session.add(AdminDebugRun(id=uuid.uuid4().hex, username=username, events=history, status=status))
    return StreamingResponse(events(), media_type='text/event-stream', headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})


class KnowledgeUploadRequest(BaseModel):
    url: str = Field(min_length=1)
    fileName: str = Field(min_length=1)


class KnowledgeSearchRequest(BaseModel):
    search: str = Field(min_length=1)


@router.post('/knowledge/upload')
def upload_knowledge(request: KnowledgeUploadRequest):
    from services.knowledge_service import KnowledgeService
    return KnowledgeService.upload_knowledge(request.url, request.fileName)


@router.post('/knowledge/file')
async def upload_knowledge_file(file: UploadFile = File(...)):
    from routers.file import _validate_upload
    from services.file_service import FileService
    from services.knowledge_service import KnowledgeService
    from starlette.concurrency import run_in_threadpool
    raw = await file.read(10 * 1024 * 1024 + 1)
    error = _validate_upload(file.filename or '', len(raw))
    if error:
        raise HTTPException(400, error)
    result = await run_in_threadpool(FileService.upload_file, raw, file.filename)
    if result.get('code') != 0:
        return result
    data = result['data']
    return await run_in_threadpool(KnowledgeService.upload_knowledge, data['url'], data['filename'])


@router.post('/knowledge/search')
def search_knowledge(request: KnowledgeSearchRequest):
    from services.knowledge_service import KnowledgeService
    return ok(KnowledgeService.search_knowledge(request.search, format='json')['results'])


@router.post('/knowledge/clear')
def clear_knowledge():
    from services.knowledge_service import KnowledgeService
    return KnowledgeService.clear_knowledge()


@router.get('/{kind}')
def listing(kind: str):
    return ok(service.list_resources(kind))


@router.get('/{kind}/{key}')
def detail(kind: str, key: str):
    return ok(service.detail(kind, key))


@router.post('/{kind}')
def create(kind: str, request: SaveRequest):
    return ok(service.save(kind, request.draft))


@router.put('/{kind}/{key}')
def update(kind: str, key: str, request: SaveRequest):
    return ok(service.save(kind, request.draft, key, request.revision))


@router.post('/{kind}/{key}/publish')
def publish(kind: str, key: str, request: RevisionRequest):
    try:
        return ok(service.publish(kind, key, request.revision))
    except (ValueError, KeyError, TypeError, PermissionError) as exc:
        raise HTTPException(400, str(exc)) from exc


@router.delete('/{kind}/{key}')
def delete_resource(kind: str, key: str, request: RevisionRequest):
    if kind == 'skills':
        row = service.detail(kind, key)
        if row['revision'] != request.revision:
            raise HTTPException(409, '内容已修改，请刷新')
        return ok(service.delete_skill(key, row['publishedVersion']))
    return ok(service.delete_resource(kind, key, request.revision))


@router.get('/skills/{key}/references')
def current_skill_references(key: str):
    row = service.detail('skills', key)
    return ok(service.skill_references(key, row['publishedVersion']))
