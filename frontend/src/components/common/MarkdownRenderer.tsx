import React from "react";

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
  className?: string;
}

// Regex to capture inline tokens: ***bold-italic***, **bold**, *italic*, __bold__, _italic_, ~~strike~~, `code`, [label](url)
const INLINE_TOKEN_REGEX =
  /(\*\*\*[^*]+?\*\*\*|___[^_]+?___|\*\*[^*]+?\*\*|__[^_]+?__|(?<!\w)\*[^*]+?\*(?!\w)|(?<!\w)_[^_]+?_(?!\w)|~~[^~]+?~~|`[^`]+?`|\[[^\]]+?\]\([^)]+?\))/g;

export function renderInlineMarkdown(text: string, isUser: boolean = false): React.ReactNode[] {
  if (!text) return [];

  const parts = text.split(INLINE_TOKEN_REGEX);

  return parts.map((part, index) => {
    if (!part) return null;

    // Bold + Italic: ***text*** or ___text___
    if (
      (part.startsWith("***") && part.endsWith("***") && part.length >= 6) ||
      (part.startsWith("___") && part.endsWith("___") && part.length >= 6)
    ) {
      const inner = part.slice(3, -3);
      return (
        <strong
          key={index}
          className={`font-bold italic ${isUser ? "text-white" : "text-(--color-text)"}`}
        >
          {inner}
        </strong>
      );
    }

    // Bold: **text** or __text__
    if (
      (part.startsWith("**") && part.endsWith("**") && part.length >= 4) ||
      (part.startsWith("__") && part.endsWith("__") && part.length >= 4)
    ) {
      const inner = part.slice(2, -2);
      return (
        <strong
          key={index}
          className={`font-bold ${isUser ? "text-white underline decoration-white/30" : "text-(--color-text)"}`}
        >
          {inner}
        </strong>
      );
    }

    // Italic: *text* or _text_
    if (
      (part.startsWith("*") && part.endsWith("*") && part.length >= 2) ||
      (part.startsWith("_") && part.endsWith("_") && part.length >= 2)
    ) {
      const inner = part.slice(1, -1);
      return (
        <em
          key={index}
          className={`italic ${isUser ? "text-white/90" : "text-(--color-text)"}`}
        >
          {inner}
        </em>
      );
    }

    // Strikethrough: ~~text~~
    if (part.startsWith("~~") && part.endsWith("~~") && part.length >= 4) {
      const inner = part.slice(2, -2);
      return (
        <del key={index} className="line-through opacity-75">
          {inner}
        </del>
      );
    }

    // Inline code: `code`
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <code
          key={index}
          className={`font-mono text-[0.88em] px-1.5 py-0.5 rounded ${
            isUser
              ? "bg-black/20 text-white"
              : "bg-black/5 dark:bg-white/10 text-(--color-text) border border-(--color-border-soft)"
          }`}
        >
          {inner}
        </code>
      );
    }

    // Link: [label](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      return (
        <a
          key={index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`font-semibold underline decoration-current underline-offset-2 hover:opacity-80 transition-opacity ${
            isUser ? "text-white font-bold" : "text-(--color-accent-text)"
          }`}
        >
          {label}
        </a>
      );
    }

    // Default plain text
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

interface ParsedBlock {
  type: "paragraph" | "heading" | "blockquote" | "ul" | "ol" | "codeblock";
  level?: number;
  text?: string;
  lines?: string[];
  items?: (string | { num: string; text: string })[];
  language?: string;
}

export default function MarkdownRenderer({ content, isUser = false, className = "" }: MarkdownRendererProps) {
  if (!content) return null;

  // Block parser
  const rawLines = content.split(/\r?\n/);
  const blocks: ParsedBlock[] = [];
  let currentList: ParsedBlock | null = null;
  let currentParagraphLines: string[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = "";

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      blocks.push({
        type: "paragraph",
        lines: [...currentParagraphLines],
      });
      currentParagraphLines = [];
    }
  };

  const flushList = () => {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    // Code block toggle
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        // End code block
        blocks.push({
          type: "codeblock",
          text: codeBlockLines.join("\n"),
          language: codeBlockLang,
        });
        codeBlockLines = [];
        codeBlockLang = "";
        inCodeBlock = false;
      } else {
        // Start code block
        flushParagraph();
        flushList();
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // Empty line -> flush blocks
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    // Heading (# Heading, ## Heading, ### Heading)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      continue;
    }

    // Blockquote (> Quote text)
    if (trimmed.startsWith(">")) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "blockquote",
        text: trimmed.replace(/^>\s*/, ""),
      });
      continue;
    }

    // Unordered list item (- item, * item, • item)
    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== "ul") {
        flushList();
        currentList = { type: "ul", items: [] };
      }
      currentList.items!.push(ulMatch[1]);
      continue;
    }

    // Ordered list item (1. item, 2. item)
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== "ol") {
        flushList();
        currentList = { type: "ol", items: [] };
      }
      currentList.items!.push({ num: olMatch[1], text: olMatch[2] });
      continue;
    }

    // Regular line in paragraph
    flushList();
    currentParagraphLines.push(rawLine);
  }

  // Final flushes
  flushParagraph();
  flushList();
  if (inCodeBlock && codeBlockLines.length > 0) {
    blocks.push({
      type: "codeblock",
      text: codeBlockLines.join("\n"),
      language: codeBlockLang,
    });
  }

  return (
    <div className={`space-y-2.5 break-words ${className}`}>
      {blocks.map((block, bIdx) => {
        switch (block.type) {
          case "heading": {
            const hText = block.text || "";
            if (block.level === 1) {
              return (
                <h1
                  key={bIdx}
                  className={`font-display text-base sm:text-lg font-bold mt-2 mb-1 ${
                    isUser ? "text-white" : "text-(--color-text)"
                  }`}
                >
                  {renderInlineMarkdown(hText, isUser)}
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2
                  key={bIdx}
                  className={`font-display text-sm sm:text-base font-bold mt-2 mb-1 ${
                    isUser ? "text-white" : "text-(--color-text)"
                  }`}
                >
                  {renderInlineMarkdown(hText, isUser)}
                </h2>
              );
            }
            return (
              <h3
                key={bIdx}
                className={`font-display text-xs sm:text-sm font-bold mt-1.5 mb-0.5 ${
                  isUser ? "text-white" : "text-(--color-text)"
                }`}
              >
                {renderInlineMarkdown(hText, isUser)}
              </h3>
            );
          }

          case "paragraph": {
            return (
              <p key={bIdx} className="leading-relaxed">
                {block.lines?.map((line, lIdx) => (
                  <React.Fragment key={lIdx}>
                    {lIdx > 0 && <br />}
                    {renderInlineMarkdown(line, isUser)}
                  </React.Fragment>
                ))}
              </p>
            );
          }

          case "ul": {
            return (
              <ul key={bIdx} className="space-y-1 my-1 pl-1">
                {block.items?.map((item, iIdx) => {
                  const text = typeof item === "string" ? item : item.text;
                  return (
                    <li key={iIdx} className="flex items-start gap-2">
                      <span
                        className={`inline-block mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          isUser ? "bg-white/80" : "bg-(--color-accent)"
                        }`}
                      />
                      <span className="flex-1 leading-relaxed">
                        {renderInlineMarkdown(text, isUser)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            );
          }

          case "ol": {
            return (
              <ol key={bIdx} className="space-y-1 my-1 pl-1">
                {block.items?.map((item, iIdx) => {
                  const num = typeof item === "string" ? `${iIdx + 1}` : item.num;
                  const text = typeof item === "string" ? item : item.text;
                  return (
                    <li key={iIdx} className="flex items-start gap-2">
                      <span
                        className={`text-xs font-mono font-bold shrink-0 mt-0.5 min-w-[1.25rem] ${
                          isUser ? "text-white/90" : "text-(--color-accent-text)"
                        }`}
                      >
                        {num}.
                      </span>
                      <span className="flex-1 leading-relaxed">
                        {renderInlineMarkdown(text, isUser)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            );
          }

          case "blockquote": {
            return (
              <blockquote
                key={bIdx}
                className={`border-l-3 pl-3 py-1 my-1 text-xs italic ${
                  isUser
                    ? "border-white/60 text-white/90 bg-white/10 rounded-r-lg"
                    : "border-(--color-accent) text-(--color-text-muted) bg-(--color-surface-2)/60 rounded-r-lg"
                }`}
              >
                {renderInlineMarkdown(block.text || "", isUser)}
              </blockquote>
            );
          }

          case "codeblock": {
            return (
              <pre
                key={bIdx}
                className="my-1.5 p-3 rounded-xl bg-black/80 text-white font-mono text-[11px] overflow-x-auto leading-normal"
              >
                <code>{block.text}</code>
              </pre>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
