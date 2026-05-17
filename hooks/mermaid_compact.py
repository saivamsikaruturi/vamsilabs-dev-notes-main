import re

INIT_CFG = "%%{init: {'flowchart': {'nodeSpacing': 18, 'rankSpacing': 35, 'padding': 8}, 'class': {'padding': 8}}}%%"

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
