import { Children, isValidElement, type ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidDiagram } from './MermaidDiagram.js';

interface CodeElementProps {
  readonly className?: string;
  readonly children?: ReactNode;
}

function textContent(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : ''))
    .join('');
}

const components: Components = {
  pre({ children }) {
    const code = Children.toArray(children).find((child) =>
      isValidElement<CodeElementProps>(child),
    );

    if (isValidElement<CodeElementProps>(code)) {
      const language = /(?:^|\s)language-([^\s]+)/.exec(code.props.className ?? '')?.[1];
      if (language?.toLowerCase() === 'mermaid') {
        return <MermaidDiagram source={textContent(code.props.children)} />;
      }
    }

    return <pre className="atlas-markdown__code">{children}</pre>;
  },
  img({ alt }) {
    return (
      <span className="atlas-markdown__image-placeholder">
        Image not loaded{alt ? `: ${alt}` : ''}
      </span>
    );
  },
  a({ href, title, children }) {
    if (href === undefined) return <>{children}</>;
    const external = /^https?:\/\//i.test(href);

    return (
      <a
        href={href}
        title={title}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    );
  },
};

interface MarkdownDocumentProps {
  readonly content: string;
}

export function MarkdownDocument({ content }: MarkdownDocumentProps) {
  return (
    <div className="atlas-markdown">
      <Markdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {content}
      </Markdown>
    </div>
  );
}
