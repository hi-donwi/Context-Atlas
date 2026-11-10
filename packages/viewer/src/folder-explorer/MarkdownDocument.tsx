import {
  Children,
  createElement,
  isValidElement,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { splitFrontmatter, type ContentSource, type FrontmatterField } from 'context-atlas-core';
import { DelimitedTable } from './DelimitedTable.js';
import { MermaidDiagram } from './MermaidDiagram.js';
import { formatExplorerLocation } from './path-state.js';
import { isSafeRasterImageContent, resolveMarkdownTarget } from './markdown-targets.js';
import { formatFolderMessage, useFolderLocale, useFolderMessages } from './locale.js';

interface CodeElementProps {
  readonly className?: string;
  readonly children?: ReactNode;
}

function textContent(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') return String(child);
      return isValidElement<{ readonly children?: ReactNode }>(child)
        ? textContent(child.props.children)
        : '';
    })
    .join('');
}

function headingSlug(children: ReactNode): string {
  const slug = textContent(children)
    .normalize('NFKD')
    .toLocaleLowerCase('en-US')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 512);
  return slug || 'section';
}

interface MarkdownImageProps {
  readonly source: ContentSource;
  readonly scopeId: string;
  readonly documentPath: string;
  readonly src?: string | undefined;
  readonly alt?: string | undefined;
  readonly title?: string | undefined;
}

function MarkdownImage({ source, scopeId, documentPath, src, alt, title }: MarkdownImageProps) {
  const text = useFolderMessages();
  const locale = useFolderLocale();
  const path = src === undefined ? undefined : resolveMarkdownTarget(documentPath, src)?.path;
  const [image, setImage] = useState<{ readonly path: string; readonly url: string } | null>(null);
  const [failedPath, setFailedPath] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setImage(null);
    setFailedPath(null);

    if (path === undefined) return () => void (active = false);

    void source
      .read(scopeId, path)
      .then((file) => {
        const mimeType = isSafeRasterImageContent(path, file);
        if (mimeType === undefined || !(file.content instanceof Uint8Array)) {
          if (active) setFailedPath(path);
          return;
        }

        const bytes = new Uint8Array(file.content);
        const url = URL.createObjectURL(new Blob([bytes.buffer], { type: mimeType }));
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setImage({ path, url });
      })
      .catch(() => {
        if (active) setFailedPath(path);
      });

    return () => {
      active = false;
      if (objectUrl !== undefined) URL.revokeObjectURL(objectUrl);
    };
  }, [path, scopeId, source]);

  if (path !== undefined && image?.path === path) {
    return (
      <img
        className="atlas-markdown__image"
        src={image.url}
        alt={alt ?? ''}
        title={title}
        loading="lazy"
        decoding="async"
      />
    );
  }

  const label = alt ? `: ${alt}` : '';
  const status =
    path !== undefined && failedPath !== path ? text.loadingImage : text.imageUnavailable;
  return (
    <span className="atlas-markdown__image-placeholder" lang={locale}>
      {status}
      {label}
    </span>
  );
}

interface MarkdownContext {
  readonly path: string;
  readonly scopeId: string;
  readonly source: ContentSource;
  readonly onNavigate: (path: string, fragment?: string) => void;
  readonly tableLabel: string;
}

function markdownComponents(context: MarkdownContext): Components {
  const headingIds = new Set<string>();
  const renderHeading = (tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6', children: ReactNode) => {
    const slug = headingSlug(children);
    let id = slug;
    let duplicateIndex = 0;
    while (headingIds.has(id)) {
      duplicateIndex += 1;
      id = `${slug}-${duplicateIndex}`;
    }
    headingIds.add(id);
    return createElement(tag, { id }, children);
  };

  return {
    h1({ children }) {
      return renderHeading('h1', children);
    },
    h2({ children }) {
      return renderHeading('h2', children);
    },
    h3({ children }) {
      return renderHeading('h3', children);
    },
    h4({ children }) {
      return renderHeading('h4', children);
    },
    h5({ children }) {
      return renderHeading('h5', children);
    },
    h6({ children }) {
      return renderHeading('h6', children);
    },
    pre({ children }) {
      const code = Children.toArray(children).find((child) =>
        isValidElement<CodeElementProps>(child),
      );

      if (isValidElement<CodeElementProps>(code)) {
        const language = /(?:^|\s)language-([^\s]+)/.exec(code.props.className ?? '')?.[1];
        const fence = language?.toLowerCase();
        if (fence === 'csv' || fence === 'tsv') {
          return (
            <DelimitedTable
              content={textContent(code.props.children)}
              delimiter={fence === 'csv' ? ',' : '\t'}
              label={formatFolderMessage(context.tableLabel, { type: fence.toUpperCase() })}
            />
          );
        }
        if (fence === 'mermaid') {
          return (
            <MermaidDiagram source={textContent(code.props.children)} documentPath={context.path} />
          );
        }
      }

      return <pre className="atlas-markdown__code">{children}</pre>;
    },
    img({ src, alt, title }) {
      return (
        <MarkdownImage
          source={context.source}
          scopeId={context.scopeId}
          documentPath={context.path}
          src={src}
          alt={alt}
          title={title}
        />
      );
    },
    a({ href, title, children }) {
      if (href === undefined) return <>{children}</>;
      const external = /^https?:\/\//i.test(href);
      const absolute = /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//');
      const target = absolute ? undefined : resolveMarkdownTarget(context.path, href);

      if (!absolute && target === undefined) {
        return <span className="atlas-markdown__link-unavailable">{children}</span>;
      }

      if (target !== undefined) {
        const fragment = target.fragment === undefined ? undefined : headingSlug(target.fragment);
        return (
          <a
            href={formatExplorerLocation(context.scopeId, target.path, fragment)}
            title={title}
            onClick={(event) => {
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              event.preventDefault();
              context.onNavigate(target.path, fragment);
            }}
          >
            {children}
          </a>
        );
      }

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
}

interface MarkdownDocumentProps {
  readonly content: string;
  readonly path: string;
  readonly scopeId: string;
  readonly source: ContentSource;
  readonly onNavigate: (path: string, fragment?: string) => void;
}

function FrontmatterCard({ fields }: { readonly fields: readonly FrontmatterField[] }) {
  const text = useFolderMessages();
  if (fields.length === 0) return null;
  return (
    <section className="atlas-frontmatter" aria-label={text.metadata}>
      <dl>
        {fields.map((field, index) => (
          <div key={`${field.key}-${index}`}>
            <dt>{field.key}</dt>
            <dd>
              {field.kind === 'structured' ? (
                <pre className="atlas-frontmatter__structured">{field.value}</pre>
              ) : (
                field.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function MarkdownDocument({
  content,
  path,
  scopeId,
  source,
  onNavigate,
}: MarkdownDocumentProps) {
  const text = useFolderMessages();
  const frontmatter = splitFrontmatter(content);
  return (
    <div className="atlas-markdown">
      {frontmatter !== undefined && <FrontmatterCard fields={frontmatter.fields} />}
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents({
          path,
          scopeId,
          source,
          onNavigate,
          tableLabel: text.tableLabel,
        })}
        skipHtml
      >
        {frontmatter?.body ?? content}
      </Markdown>
    </div>
  );
}
