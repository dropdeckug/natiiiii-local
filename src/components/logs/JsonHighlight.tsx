import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Minimal JSON tokenizer + renderer with real syntax highlighting.
 *
 * Every colour is a semantic token so the pane themes correctly:
 *   keys → primary, strings → success, numbers → warning,
 *   booleans / null → destructive, braces & commas → muted.
 */
type TokenKind = "key" | "string" | "number" | "boolean" | "null" | "punct" | "plain";

const TOKEN_CLASS: Record<TokenKind, string> = {
  key: "text-primary",
  string: "text-success",
  number: "text-warning",
  boolean: "text-destructive",
  null: "text-destructive/80",
  punct: "text-muted-foreground",
  plain: "text-foreground",
};

const TOKEN_RE =
  /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b|([{}[\],:])/g;

function tokenize(source: string): { kind: TokenKind; text: string }[] {
  const tokens: { kind: TokenKind; text: string }[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(source))) {
    if (match.index > last) tokens.push({ kind: "plain", text: source.slice(last, match.index) });
    const kind: TokenKind = match[1]
      ? "key"
      : match[2]
        ? "string"
        : match[3]
          ? "number"
          : match[4]
            ? "boolean"
            : match[5]
              ? "null"
              : "punct";
    tokens.push({ kind, text: match[0] });
    last = match.index + match[0].length;
  }
  if (last < source.length) tokens.push({ kind: "plain", text: source.slice(last) });
  return tokens;
}

export default function JsonHighlight({ value, className }: { value: unknown; className?: string }) {
  const [copied, setCopied] = useState(false);
  const json = useMemo(() => {
    try {
      return JSON.stringify(value, null, 2) ?? "null";
    } catch {
      return String(value);
    }
  }, [value]);
  const tokens = useMemo(() => tokenize(json), [json]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => void copy()}
        className="absolute right-0 top-0 h-6 w-6 border border-border bg-card"
        aria-label="Copy JSON"
      >
        {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      </Button>
      <pre className="min-w-max whitespace-pre-wrap break-words pr-8 font-mono text-[11px] leading-5">
        {tokens.map((token, index) => (
          <span key={index} className={TOKEN_CLASS[token.kind]}>
            {token.text}
          </span>
        ))}
      </pre>
    </div>
  );
}
