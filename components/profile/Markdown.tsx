"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { cx } from "@/components/design-system";

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), ["target"], ["rel"]],
    img: [...(defaultSchema.attributes?.img ?? []), ["loading"], ["referrerpolicy"]],
  },
};

interface MarkdownProps {
  children: string;
  className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div
      className={cx(
        "prose-sm break-words text-[13px] leading-relaxed text-[var(--color-fg-muted)]",
        "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-[15px] [&_h1]:font-semibold [&_h1]:text-[var(--color-fg)]",
        "[&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-[14px] [&_h2]:font-semibold [&_h2]:text-[var(--color-fg)]",
        "[&_h3]:mt-2.5 [&_h3]:mb-1 [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:text-[var(--color-fg)]",
        "[&_h4]:mt-2 [&_h4]:mb-1 [&_h4]:text-[12.5px] [&_h4]:font-semibold [&_h4]:text-[var(--color-fg)]",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5 [&_li]:marker:text-[var(--color-fg-subtle)]",
        "[&_a]:text-[var(--color-accent)] [&_a]:underline [&_a]:decoration-[var(--color-border-strong)] [&_a]:underline-offset-2 hover:[&_a]:decoration-[var(--color-accent)]",
        "[&_strong]:font-semibold [&_strong]:text-[var(--color-fg)]",
        "[&_em]:italic",
        "[&_code]:rounded [&_code]:border [&_code]:border-[var(--glass-border)] [&_code]:bg-[var(--theme-compat-bg)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-[var(--color-fg-muted)]",
        "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-[var(--glass-border)] [&_pre]:bg-[var(--theme-compat-bg)] [&_pre]:p-3 [&_pre]:text-[12px]",
        "[&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--color-border)] [&_blockquote]:pl-3 [&_blockquote]:text-[var(--color-fg-muted)]",
        "[&_hr]:my-3 [&_hr]:border-[var(--color-border)]",
        "[&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-lg",
        "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[12.5px]",
        "[&_th]:border [&_th]:border-[var(--glass-border)] [&_th]:bg-[var(--theme-compat-bg)] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold",
        "[&_td]:border [&_td]:border-[var(--glass-border)] [&_td]:px-2 [&_td]:py-1",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener" />
          ),
          img: ({ node: _node, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              {...props}
              alt={typeof props.alt === "string" ? props.alt : ""}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
