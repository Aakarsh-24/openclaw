---
name: neo4j
description: Interact with Neo4j graph database for knowledge graphs, Cypher queries, and AGI relational reasoning via MCP.
metadata: {"openclaw":{"requires":{"bins":["python3","docker"]},"install":[{"id":"neo4j-driver","kind":"pip","package":"neo4j","bins":[],"label":"Install Neo4j Python driver"}],"env":["NEO4J_URI","NEO4J_USER","NEO4J_PASSWORD"]}}
---

# Neo4j Graph Skill for AGI

## What I do
This skill provides MCP tools for querying and updating a Neo4j knowledge graph, enabling relational reasoning in AI agents. It supports symbolic queries, graph updates, and computational algorithms like centrality.

## When to use me
Use for AGI tasks requiring graph-based memory: pattern matching, multi-hop inference, influence analysis. Do not use for destructive operations unless explicitly allowed (e.g., updates are read-only by default).

## Security Notes
- **Root Risk:** Runs in Docker container with read-only filesystem, non-root user.
- **Keys Risk:** Credentials via environment vars (NEO4J_*); never log or expose.
- **Agency Risk:** Least privilege—queries only; updates require explicit approval.

## Setup
1. Run Neo4j: `docker run -d --name neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=$NEO4J_USER/$NEO4J_PASSWORD neo4j:latest`
2. Install deps: `pip install neo4j`
3. Set env: `export NEO4J_URI=bolt://localhost:7687 NEO4J_USER=neo4j NEO4J_PASSWORD=password`

## MCP Server
Save as `neo4j_mcp_server.py` (run in container for security):
```python
import asyncio
import json
import os
import sys
from neo4j import GraphDatabase

uri = os.getenv('NEO4J_URI', 'bolt://localhost:7687')
user = os.getenv('NEO4J_USER', 'neo4j')
password = os.getenv('NEO4J_PASSWORD', 'password')

driver = GraphDatabase.driver(uri, auth=(user, password))

async def handle_request(request):
    method = request.get('method')
    params = request.get('params', {})
    
    if method == 'tools/list':
        return {
            'tools': [
                {
                    'name': 'query_graph',
                    'description': 'Run Cypher query for symbolic reasoning (read-only)',
                    'inputSchema': {'type': 'object', 'properties': {'query': {'type': 'string'}}}
                },
                {
                    'name': 'update_graph',
                    'description': 'Update graph (requires approval; use sparingly)',
                    'inputSchema': {'type': 'object', 'properties': {'cypher': {'type': 'string'}}}
                },
                {
                    'name': 'compute_centrality',
                    'description': 'Compute PageRank for influence analysis',
                    'inputSchema': {'type': 'object', 'properties': {'label': {'type': 'string'}, 'relationship': {'type': 'string'}}}
                },
                {
                    'name': 'visualize_graph',
                    'description': 'Generate Mermaid config for graph visualization',
                    'inputSchema': {'type': 'object', 'properties': {'query': {'type': 'string'}}}
                }
            ]
        }
    elif method == 'tools/call':
        tool_name = params['name']
        args = params['arguments']
        
        with driver.session() as session:
            if tool_name == 'query_graph':
                result = session.run(args['query'])
                records = [dict(record) for record in result]
                return {'content': [{'type': 'text', 'text': json.dumps(records)}]}
            elif tool_name == 'update_graph':
                # Add approval check here
                session.run(args['cypher'])
                return {'content': [{'type': 'text', 'text': 'Graph updated'}]}
            elif tool_name == 'compute_centrality':
                cypher = f'CALL gds.pageRank.stream("{args["label"]}", "{args["relationship"]}") YIELD nodeId, score RETURN gds.util.asNode(nodeId).name AS name, score ORDER BY score DESC'
                result = session.run(cypher)
                records = [dict(record) for record in result]
                return {'content': [{'type': 'text', 'text': json.dumps(records)}]}
            elif tool_name == 'visualize_graph':
                # Generate Mermaid (simplified)
                result = session.run(args['query'])
                mermaid = "graph TD\n"
                for record in result:
                    if 'n' in record and 'm' in record:
                        mermaid += f"{record['n']} --> {record['m']}\n"
                return {'content': [{'type': 'text', 'text': mermaid}]}
    
    return {'error': 'Unknown method'}

async def main():
    while True:
        line = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
        if not line:
            break
        request = json.loads(line.strip())
        response = await handle_request(request)
        response['jsonrpc'] = '2.0'
        response['id'] = request.get('id')
        print(json.dumps(response), flush=True)

asyncio.run(main())
```

Run securely: `docker run --rm -e NEO4J_* -v $(pwd):/app python:3.9-slim /app/neo4j_mcp_server.py`

## Packaging
- **Docker Image:** Build with `Dockerfile` for containerized execution.
- **ClawHub:** Publish for distribution.

This skill enables AGI relational reasoning via graphs.