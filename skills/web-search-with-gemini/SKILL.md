---
name: web-search-with-gemini
description: Perform deep research queries using Gemini with multi-perspective reasoning, answering in Russian.
metadata: {"clawdis":{"emoji":"🔍","requires":{"bins":["web_search_with_gemini"]},"install":[{"id":"manual","kind":"manual","instructions":"Script at scripts/web_search_with_gemini.sh"}]}}
---

# web-search-with-gemini

This skill wraps the Gemini CLI to perform "Deep Research" and "Ultrathink" queries. It automatically appends instructions for Google search, deep diving, and multi-perspective reasoning.

## Features

- **Automated Deep Research**: Triggers Google search and deep dive modes.
- **Ultrathink Reasoning**: Uses collective multi-perspective reasoning for high-quality answers.
- **Russian Language Output**: Strictly enforces answers in Russian with appropriate emojis.
- **Customizable**: Supports model and output format overrides.

## Usage

- **Basic**: `web_search_with_gemini "Who won the World Cup in 2022?"`
- **Specific Model**: `web_search_with_gemini --model gemini-2.0-flash "Latest AI trends"`
- **JSON Output**: `web_search_with_gemini --output-format json "Current stock price of NVIDIA"`

## How it Works

The tool appends the following tail to your query:
`. google it, deep dive, deep research, answer strictly in russian language. ultrathink,[ultrathink, use collective multi-perspective reasoning with multi-perspective consulting before making any decision with emoji in russian language !]`

## When to Use

- When you need a deep research on a topic with a summary in Russian.
- To get a multi-perspective analysis of complex questions.
- For queries where the answer requires the latest information from the web.
