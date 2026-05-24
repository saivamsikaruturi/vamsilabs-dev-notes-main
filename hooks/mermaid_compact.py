import re

INIT_CFG = "%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '13px', 'fontFamily': 'Inter, -apple-system, sans-serif'}, 'flowchart': {'nodeSpacing': 30, 'rankSpacing': 50, 'padding': 12, 'curve': 'basis'}, 'sequence': {'actorMargin': 60, 'messageMargin': 40}, 'class': {'padding': 12}}}%%"

def on_page_markdown(markdown, **kwargs):
    def inject(m):
        indent = m.group(1)
        block = m.group(2)
        if indent:
            return m.group(0)
        if block.lstrip().startswith("%%{init"):
            return m.group(0)
        return "```mermaid\n" + INIT_CFG + "\n" + block + "```"

    return re.sub(r"^([ \t]*)```mermaid\n(.*?)^\1```", inject, markdown, flags=re.DOTALL | re.MULTILINE)
