import React from 'react';

function highlight(json: string): string {
  const escaped = json.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'jn';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'jk' : 'js';
      } else if (/true|false/.test(match)) {
        cls = 'jb';
      } else if (/null/.test(match)) {
        cls = 'jz';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

export const JsonView: React.FC<{ data: unknown }> = ({ data }) => {
  const json = JSON.stringify(data, null, 2) ?? '';
  return <pre className="json" dangerouslySetInnerHTML={{ __html: highlight(json) }} />;
};
