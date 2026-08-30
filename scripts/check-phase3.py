import re
with open('AGENT_HANDOFF.md', 'r', encoding='utf-8') as f:
    content = f.read()

phase3_re = r'(### Phase 3.*?)(### Phase 4)'
def check_phase3(match):
    return match.group(1).replace('- [ ]', '- [x]') + match.group(2)
content = re.sub(phase3_re, check_phase3, content, flags=re.DOTALL)

with open('AGENT_HANDOFF.md', 'w', encoding='utf-8') as f:
    f.write(content)
