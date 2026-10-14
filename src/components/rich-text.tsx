import Markdown, { type Components } from "react-markdown";

// Maia writes Markdown. Tailwind resets list and heading styles, so put back
// just enough for chat bubbles. Raw HTML in the text is never rendered.
const components: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  h1: ({ children }) => <p className="mt-3 mb-1 font-semibold">{children}</p>,
  h2: ({ children }) => <p className="mt-3 mb-1 font-semibold">{children}</p>,
  h3: ({ children }) => <p className="mt-3 mb-1 font-semibold">{children}</p>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
      {children}
    </a>
  ),
};

export default function RichText({ text }: { text: string }) {
  return <Markdown components={components}>{text}</Markdown>;
}
