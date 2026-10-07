/**
 * Just enough Markdown for the creator guide inside the game: headings,
 * paragraphs, lists, quotes, code and links. Text is escaped first, so the
 * guide can never inject markup.
 */
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s: string): string {
  return escape(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<span class="ref">$1</span>');
}

export function markdown(src: string): string {
  const out: string[] = [];
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  let list: 'ul' | 'ol' | null = null;
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const endList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.startsWith('```')) {
      flush();
      endList();
      const code: string[] = [];
      while (++i < lines.length && !(lines[i] ?? '').startsWith('```')) code.push(lines[i] ?? '');
      out.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      endList();
      const level = Math.min(4, (heading[1]?.length ?? 1) + 1);
      out.push(`<h${level}>${inline(heading[2] ?? '')}</h${level}>`);
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flush();
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) {
        endList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((bullet ?? numbered)?.[1] ?? '')}</li>`);
      continue;
    }
    if (line.startsWith('>')) {
      flush();
      endList();
      out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`);
      continue;
    }
    if (line.trim() === '') {
      flush();
      endList();
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) {
      out[out.length - 1] = (out[out.length - 1] ?? '').replace(/<\/li>$/, ` ${inline(line.trim())}</li>`);
      continue;
    }
    endList();
    para.push(line.trim());
  }
  flush();
  endList();
  return out.join('\n');
}
