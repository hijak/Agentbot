import type { ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

function openLink(href: string) {
  if (window.ogb?.openExternal) {
    void window.ogb.openExternal(href);
    return;
  }
  window.open(href, "_blank", "noopener,noreferrer");
}

function flattenCode(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenCode).join("");
  if (node && typeof node === "object" && "props" in node) {
    return flattenCode((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

/** GFM markdown for chat bubbles (Andromeda tokens). */
export function ChatMarkdownView({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="ah-md">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            if (!href) return <span>{children}</span>;
            return (
              <a
                href={href}
                className="ah-link break-words"
                onClick={(event) => {
                  event.preventDefault();
                  openLink(href);
                }}
              >
                {children}
              </a>
            );
          },
          pre({ children }) {
            const child = Array.isArray(children) ? children[0] : children;
            const className =
              child && typeof child === "object" && "props" in child
                ? String((child as { props?: { className?: string } }).props?.className ?? "")
                : "";
            const lang = /language-([^\s]+)/.exec(className)?.[1] ?? "";
            const code = flattenCode(
              child && typeof child === "object" && "props" in child
                ? (child as { props?: { children?: ReactNode } }).props?.children
                : child,
            ).replace(/\n$/, "");
            return (
              <pre className="ah-md-pre" data-lang={lang || undefined}>
                <code>{code}</code>
              </pre>
            );
          },
          code({ className, children }) {
            if (className?.includes("language-")) return <code className={className}>{children}</code>;
            return <code className="ah-md-inline-code">{children}</code>;
          },
          ul({ children }) {
            return <ul className="ah-md-list list-disc">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="ah-md-list list-decimal">{children}</ol>;
          },
          blockquote({ children }) {
            return <blockquote className="ah-md-quote">{children}</blockquote>;
          },
          table({ children }) {
            return (
              <div className="ah-md-table-wrap">
                <table>{children}</table>
              </div>
            );
          },
          h1({ children }) {
            return <h3 className="ah-md-heading">{children}</h3>;
          },
          h2({ children }) {
            return <h3 className="ah-md-heading">{children}</h3>;
          },
          h3({ children }) {
            return <h4 className="ah-md-heading">{children}</h4>;
          },
          h4({ children }) {
            return <h4 className="ah-md-heading">{children}</h4>;
          },
          h5({ children }) {
            return <h5 className="ah-md-heading">{children}</h5>;
          },
          h6({ children }) {
            return <h5 className="ah-md-heading">{children}</h5>;
          },
          hr() {
            return <hr className="ah-md-hr" />;
          },
          img({ src, alt }) {
            if (!src) return null;
            return <img src={src} alt={alt ?? ""} className="ah-md-img" loading="lazy" />;
          },
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}

export const HostedMarkdown = ChatMarkdownView;
