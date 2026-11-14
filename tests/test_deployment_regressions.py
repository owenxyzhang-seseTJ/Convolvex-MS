"""Regressions found while deploying the local HTTP services."""
import pytest
from fastapi.testclient import TestClient
from convolvex import __version__
from convolvex.mcp_server import MCPApplication, create_http_app
from convolvex.ms_workspace import MSWorkspace
from convolvex.service import create_app


def test_http_reports_installed_version(tmp_path):
    with TestClient(create_app(tmp_path)) as client:
        assert client.get('/api/v1/health').json()['version'] == __version__
        assert client.get('/api/v1/capabilities').json()['version'] == __version__
        assert client.get('/openapi.json').json()['info']['version'] == __version__


@pytest.mark.parametrize('transport', ['legacy', 'mcp'])
def test_non_ascii_authorization_is_rejected(tmp_path, monkeypatch, transport):
    token = 'test-local-token-' * 3
    if transport == 'legacy':
        monkeypatch.setenv('CONVOLVEX_TOKEN', token)
        app = create_app(tmp_path)
        url = '/api/v1/health'
        base_url = 'http://testserver'
    else:
        app = create_http_app(MCPApplication(MSWorkspace(tmp_path)), token)
        url = '/mcp'
        base_url = 'http://127.0.0.1:8766'
    with TestClient(app, base_url=base_url) as client:
        response = client.get(url, headers=[(b'authorization', b'Bearer \xff')])
        assert response.status_code == 401
